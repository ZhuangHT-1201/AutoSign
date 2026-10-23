import type { ResolvedConnectionMode } from '../types';

export function connectionModeFromProbe(
  status: number,
  finalUrl: string,
): ResolvedConnectionMode {
  let finalHost = '';
  try {
    finalHost = new URL(finalUrl).hostname.toLowerCase();
  } catch {
    return 'webvpn';
  }

  const redirectedToLogin = finalHost === 'sso.buaa.edu.cn' && status === 200;
  const portalReachable =
    finalHost === 'byxt.buaa.edu.cn' &&
    status >= 200 &&
    status < 500 &&
    status !== 404;
  return redirectedToLogin || portalReachable ? 'direct' : 'webvpn';
}
