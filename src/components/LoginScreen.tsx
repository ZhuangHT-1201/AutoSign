import {
  ArrowRight,
  CalendarCheck2,
  ChevronDown,
  Globe2,
  LoaderCircle,
  MapPinCheck,
  MonitorSmartphone,
  Sparkles,
  Wifi,
} from 'lucide-react';
import type { ConnectionMode, Profile } from '../types';
import { Logo } from './Logo';

interface LoginScreenProps {
  modePreference: ConnectionMode;
  onModeChange: (mode: ConnectionMode) => void;
  onConnect: () => void;
  onDemo: () => void;
  onOffline: () => void;
  canOpenOffline: boolean;
  offlineProfile: Profile | null;
  busy: boolean;
  error: string;
  platform: string;
}

const MODES: Array<{ value: ConnectionMode; title: string; note: string }> = [
  { value: 'auto', title: '自动连接', note: '自动选择连接方式' },
  { value: 'direct', title: '校园网直连', note: '校园网络' },
  { value: 'webvpn', title: 'WebVPN', note: '校外访问' },
];

export function LoginScreen({
  modePreference,
  onModeChange,
  onConnect,
  onDemo,
  onOffline,
  canOpenOffline,
  offlineProfile,
  busy,
  error,
  platform,
}: LoginScreenProps) {
  const selected = MODES.find((item) => item.value === modePreference) ?? MODES[0];
  const ModeIcon = modePreference === 'direct' ? Wifi : modePreference === 'webvpn' ? Globe2 : Sparkles;

  return (
    <main className="login-shell">
      <div className="login-shell__grid" />
      <div className="login-shell__orb login-shell__orb--one" />
      <div className="login-shell__orb login-shell__orb--two" />

      <section className="login-story">
        <header className="login-story__top">
          <Logo inverse />
          <span className="platform-pill">{platform}</span>
        </header>

        <div className="login-story__content">
          <div className="eyebrow eyebrow--light">
            <span />
            校园日程
          </div>
          <h1>课表与签到</h1>
          <p className="login-story__intro">登录后查看课程与签到状态。</p>

          <div className="feature-rail">
            <article>
              <span className="feature-rail__icon"><CalendarCheck2 size={21} /></span>
              <div><strong>课表</strong><p>学期、周次与今日课程</p></div>
            </article>
            <article>
              <span className="feature-rail__icon"><MapPinCheck size={21} /></span>
              <div><strong>签到</strong><p>查看课程并签到</p></div>
            </article>
            <article>
              <span className="feature-rail__icon"><MonitorSmartphone size={21} /></span>
              <div><strong>多端</strong><p>Windows 与 Android</p></div>
            </article>
          </div>
        </div>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel__heading">
            <h2>登录</h2>
            <p>使用学校统一身份认证</p>
          </div>

          <div className="login-field">
            <label>连接方式</label>
            <div className="mode-select">
              <span className="mode-select__icon"><ModeIcon size={19} /></span>
              <div>
                <strong>{selected.title}</strong>
                <small>{selected.note}</small>
              </div>
              <ChevronDown size={18} className="mode-select__chevron" />
              <select
                value={modePreference}
                onChange={(event) => onModeChange(event.target.value as ConnectionMode)}
                aria-label="连接方式"
              >
                {MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.title}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="inline-error">{error}</div>}

          <button className="primary-button primary-button--wide" onClick={onConnect} disabled={busy}>
            {busy ? <LoaderCircle size={19} className="spin" /> : null}
            {busy ? '正在打开认证页面…' : '登录'}
            {!busy && <ArrowRight size={18} className="primary-button__trailing" />}
          </button>

          <div className="login-divider"><span>或</span></div>

          <button className="secondary-button secondary-button--wide" onClick={onDemo} disabled={busy}>
            <Sparkles size={18} />
            演示模式
          </button>

          {canOpenOffline && (
            <button className="offline-link" onClick={onOffline} disabled={busy}>
              <CalendarCheck2 size={17} />
              查看 {offlineProfile?.displayName ?? '最近账号'} 的离线课表
              <ArrowRight size={15} />
            </button>
          )}

        </div>
      </section>
    </main>
  );
}
