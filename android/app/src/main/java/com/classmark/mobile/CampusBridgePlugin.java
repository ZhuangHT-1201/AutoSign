package com.classmark.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.CookieManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "CampusBridge")
public class CampusBridgePlugin extends Plugin {
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(
        Arrays.asList(
            "byxt.buaa.edu.cn",
            "sso.buaa.edu.cn",
            "uc.buaa.edu.cn",
            "gsmis.buaa.edu.cn",
            "iclass.buaa.edu.cn",
            "d.buaa.edu.cn"
        )
    );

    private boolean isAllowedUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            return host != null &&
                ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) &&
                ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT));
        } catch (Exception ignored) {
            return false;
        }
    }

    @PluginMethod
    public void request(PluginCall call) {
        String rawUrl = call.getString("url");
        if (rawUrl == null || !isAllowedUrl(rawUrl)) {
            call.reject("不允许访问该网络地址。");
            return;
        }

        String requestedMethod = call.getString("method", "GET").toUpperCase(Locale.ROOT);
        String method = Arrays.asList("GET", "POST", "HEAD").contains(requestedMethod)
            ? requestedMethod
            : "GET";
        Integer configuredTimeout = call.getInt("timeoutMs", 12000);
        int timeout = Math.max(1000, Math.min(configuredTimeout == null ? 12000 : configuredTimeout, 30000));
        boolean redirect = !Boolean.FALSE.equals(call.getBoolean("redirect", true));
        JSObject headersObject = call.getObject("headers");
        JSObject headers = new JSObject();
        if (headersObject != null) {
            Iterator<String> iterator = headersObject.keys();
            while (iterator.hasNext()) {
                String key = iterator.next();
                String value = headersObject.getString(key);
                if (value != null) headers.put(key, value);
            }
        }

        getBridge().execute(() -> {
            try {
                JSObject result = performRequest(
                    rawUrl,
                    method,
                    call.getString("body"),
                    headers,
                    timeout,
                    redirect
                );
                call.resolve(result);
            } catch (Exception error) {
                String message = error.getMessage();
                call.reject(isBlank(message) ? "校园网络请求失败。" : message);
            }
        });
    }

    @PluginMethod
    public void openAuth(PluginCall call) {
        String startUrl = call.getString("startUrl");
        if (startUrl == null || !isAllowedUrl(startUrl)) {
            call.reject("不支持校园认证地址。");
            return;
        }
        Intent intent = new Intent(getActivity(), CampusAuthActivity.class);
        intent.putExtra(CampusAuthActivity.EXTRA_START_URL, startUrl);
        java.util.regex.Matcher homeapp = java.util.regex.Pattern
            .compile("^(.*?/jwapp/sys/homeapp)(?:/|$)")
            .matcher(startUrl);
        if (homeapp.find()) {
            intent.putExtra(
                CampusAuthActivity.EXTRA_PROBE_URL,
                homeapp.group(1) + "/api/home/currentUser.do"
            );
        }
        intent.putExtra(CampusAuthActivity.EXTRA_TITLE, call.getString("title", "校园统一认证"));
        com.getcapacitor.JSArray markerArray = call.getArray(
            "successMarkers",
            new com.getcapacitor.JSArray()
        );
        List<String> markers = new ArrayList<>();
        try {
            for (int i = 0; i < markerArray.length(); i++) {
                markers.add(markerArray.getString(i));
            }
        } catch (Exception ignored) {
            // Invalid marker entries are skipped.
        }
        StringBuilder markerPayload = new StringBuilder();
        for (String marker : markers) {
            if (markerPayload.length() > 0) markerPayload.append('\n');
            markerPayload.append(marker);
        }
        intent.putExtra(CampusAuthActivity.EXTRA_MARKERS, markerPayload.toString());
        startActivityForResult(call, intent, "authResult");
    }

    @ActivityCallback
    private void authResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject response = new JSObject();
        Intent data = result.getData();
        boolean success = result.getResultCode() == android.app.Activity.RESULT_OK &&
            data != null &&
            data.getBooleanExtra(CampusAuthActivity.EXTRA_SUCCESS, false);
        response.put("success", success);
        response.put(
            "url",
            data == null ? "" : data.getStringExtra(CampusAuthActivity.EXTRA_FINAL_URL)
        );
        response.put("cancelled", !success);
        call.resolve(response);
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.removeAllCookies(value -> {
            cookieManager.flush();
            call.resolve();
        });
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("不支持的外部链接。");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("没有可打开此链接的应用。");
        }
    }

    private JSObject performRequest(
        String startUrl,
        String initialMethod,
        String initialBody,
        JSObject headers,
        int timeout,
        boolean followRedirects
    ) throws Exception {
        String currentUrl = startUrl;
        String method = initialMethod;
        String body = initialBody;
        HttpURLConnection connection = null;
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);

        for (int redirectCount = 0; redirectCount <= 12; redirectCount++) {
            URL url = new URL(currentUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(timeout);
            connection.setReadTimeout(timeout);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept-Language", "zh-CN,zh;q=0.9");
            connection.setRequestProperty(
                "User-Agent",
                "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36 Classmark/0.1.1"
            );
            String cookies = cookieManager.getCookie(currentUrl);
            if (!isBlank(cookies)) {
                connection.setRequestProperty("Cookie", cookies);
            }
            Iterator<String> headerKeys = headers.keys();
            while (headerKeys.hasNext()) {
                String key = headerKeys.next();
                String value = headers.getString(key);
                if (value != null && !"cookie".equalsIgnoreCase(key)) {
                    connection.setRequestProperty(key, value);
                }
            }
            if (body != null && !"GET".equals(method) && !"HEAD".equals(method)) {
                connection.setDoOutput(true);
                connection.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            }

            int status = connection.getResponseCode();
            for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                if (entry.getKey() == null || !"set-cookie".equalsIgnoreCase(entry.getKey())) continue;
                for (String cookie : entry.getValue()) {
                    cookieManager.setCookie(currentUrl, cookie);
                }
            }
            cookieManager.flush();

            if (followRedirects && status >= 300 && status <= 399) {
                String location = connection.getHeaderField("Location");
                if (!isBlank(location)) {
                    String nextUrl = new URL(url, location).toString();
                    if (!isAllowedUrl(nextUrl)) {
                        throw new IllegalStateException("认证跳转离开了允许的校园域名。");
                    }
                    if (status == 303 || ((status == 301 || status == 302) && "POST".equals(method))) {
                        method = "GET";
                        body = null;
                    }
                    connection.disconnect();
                    currentUrl = nextUrl;
                    continue;
                }
            }

            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            String responseBody = stream == null ? "" : readAll(stream);
            String contentType = connection.getContentType();
            JSObject result = new JSObject();
            result.put("status", status);
            result.put("body", responseBody);
            result.put("url", currentUrl);
            result.put("contentType", contentType == null ? "" : contentType);
            connection.disconnect();
            return result;
        }
        if (connection != null) connection.disconnect();
        throw new IllegalStateException("认证跳转次数过多。");
    }

    private String readAll(InputStream input) throws Exception {
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = stream.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
