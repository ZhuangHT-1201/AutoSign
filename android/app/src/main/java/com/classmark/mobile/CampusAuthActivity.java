package com.classmark.mobile;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.annotation.Nullable;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class CampusAuthActivity extends AppCompatActivity {
    public static final String EXTRA_START_URL = "startUrl";
    public static final String EXTRA_PROBE_URL = "probeUrl";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_MARKERS = "markers";
    public static final String EXTRA_SUCCESS = "success";
    public static final String EXTRA_FINAL_URL = "finalUrl";

    private WebView webView;
    private String[] markers = new String[0];
    private String probeUrl;
    private boolean finishedWithResult = false;
    private boolean probing = false;
    private final Runnable successRunnable = this::probeAndComplete;

    @Override
    @SuppressLint("SetJavaScriptEnabled")
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String startUrl = getIntent().getStringExtra(EXTRA_START_URL);
        probeUrl = getIntent().getStringExtra(EXTRA_PROBE_URL);
        String title = getIntent().getStringExtra(EXTRA_TITLE);
        String markerText = getIntent().getStringExtra(EXTRA_MARKERS);
        if (markerText != null && !markerText.trim().isEmpty()) markers = markerText.split("\n");
        if (startUrl == null) {
            finish();
            return;
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(246, 248, 245));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(4), dp(8), dp(4));
        toolbar.setBackgroundColor(Color.rgb(246, 248, 245));

        Button close = new Button(this);
        close.setText("取消");
        close.setAllCaps(false);
        close.setTextColor(Color.rgb(44, 107, 94));
        close.setBackgroundColor(Color.TRANSPARENT);
        close.setOnClickListener(view -> complete(false, webView.getUrl()));
        toolbar.addView(close, new LinearLayout.LayoutParams(dp(72), dp(48)));

        TextView heading = new TextView(this);
        heading.setText(title == null ? "校园统一认证" : title);
        heading.setTextColor(Color.rgb(25, 52, 47));
        heading.setTextSize(15);
        heading.setGravity(Gravity.CENTER);
        heading.setSingleLine(true);
        toolbar.addView(
            heading,
            new LinearLayout.LayoutParams(0, dp(48), 1f)
        );

        Button continueButton = new Button(this);
        continueButton.setText("完成");
        continueButton.setAllCaps(false);
        continueButton.setTextColor(Color.rgb(44, 107, 94));
        continueButton.setBackgroundColor(Color.TRANSPARENT);
        continueButton.setOnClickListener(view -> complete(true, webView.getUrl()));
        toolbar.addView(continueButton, new LinearLayout.LayoutParams(dp(72), dp(48)));
        root.addView(toolbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setSaveFormData(false);
        settings.setUserAgentString(settings.getUserAgentString() + " Classmark/0.1.2");
        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(
            new WebViewClient() {
                private void inspect(String url) {
                    if (finishedWithResult || url == null) return;
                    for (String marker : markers) {
                        if (!marker.trim().isEmpty() && url.contains(marker)) {
                            webView.removeCallbacks(successRunnable);
                            webView.postDelayed(successRunnable, 700);
                            break;
                        }
                    }
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    if (url.startsWith("https://") || url.startsWith("http://")) {
                        view.loadUrl(url);
                        return true;
                    }
                    return true;
                }

                @Override
                public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                    super.onPageStarted(view, url, favicon);
                    inspect(url);
                }

                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    inspect(url);
                }
            }
        );
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    if (webView != null && webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        setEnabled(false);
                        getOnBackPressedDispatcher().onBackPressed();
                    }
                }
            }
        );
        webView.loadUrl(startUrl);
    }

    private void complete(boolean success, String finalUrl) {
        if (finishedWithResult) return;
        finishedWithResult = true;
        Intent result = new Intent();
        result.putExtra(EXTRA_SUCCESS, success);
        result.putExtra(EXTRA_FINAL_URL, finalUrl == null ? "" : finalUrl);
        CookieManager.getInstance().flush();
        setResult(success ? Activity.RESULT_OK : Activity.RESULT_CANCELED, result);
        finish();
    }

    private void probeAndComplete() {
        if (finishedWithResult || webView == null) return;
        if (probeUrl == null || probeUrl.trim().isEmpty()) {
            complete(true, webView.getUrl());
            return;
        }
        if (probing) return;
        probing = true;
        String quotedUrl = org.json.JSONObject.quote(probeUrl);
        String script =
            "(async () => { try { " +
            "const response = await fetch(" + quotedUrl + ", { credentials: 'include', " +
            "headers: { 'X-Requested-With': 'XMLHttpRequest' } }); " +
            "const body = (await response.text()).trim(); " +
            "return response.ok && (body.startsWith('{') || body.startsWith('[')) && " +
            "!body.includes('统一身份认证') && !body.includes('name=\"execution\"'); " +
            "} catch (_) { return false; } })()";
        webView.evaluateJavascript(
            script,
            value -> {
                probing = false;
                if ("true".equals(value)) {
                    complete(true, webView.getUrl());
                }
            }
        );
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeCallbacks(successRunnable);
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
