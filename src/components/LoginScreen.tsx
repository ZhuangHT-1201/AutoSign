import {
  ArrowRight,
  CalendarCheck2,
  Check,
  ChevronDown,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  MapPinCheck,
  ShieldCheck,
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
  { value: 'auto', title: '自动连接', note: '优先校园直连，不可用时切换 WebVPN' },
  { value: 'direct', title: '校园网直连', note: '连接稳定，适合校内网络' },
  { value: 'webvpn', title: 'WebVPN', note: '校外访问时使用学校 WebVPN' },
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
            轻盈的校园日程
          </div>
          <h1>
            把今天，
            <br />
            安排得<span>刚刚好。</span>
          </h1>
          <p className="login-story__intro">
            课表、课堂签到与接下来要发生的事，都收进一个安静清楚的界面里。
          </p>

          <div className="feature-rail">
            <article>
              <span className="feature-rail__icon"><CalendarCheck2 size={21} /></span>
              <div><strong>课表一眼看清</strong><p>周视图与今日安排，自动定位当前周。</p></div>
            </article>
            <article>
              <span className="feature-rail__icon"><MapPinCheck size={21} /></span>
              <div><strong>签到集中处理</strong><p>状态实时刷新，不遗漏可签到的课堂。</p></div>
            </article>
            <article>
              <span className="feature-rail__icon"><ShieldCheck size={21} /></span>
              <div><strong>账号留在本机</strong><p>无需自建服务器，不保存你的登录密码。</p></div>
            </article>
          </div>
        </div>

        <footer className="login-story__footer">
          <div className="avatar-stack" aria-hidden="true">
            <span>周</span><span>课</span><span>签</span>
          </div>
          <p>本地优先 · 开源透明 · 跨端同步你的校园节奏</p>
        </footer>
      </section>

      <section className="login-panel-wrap">
        <div className="login-panel">
          <div className="login-panel__heading">
            <span className="login-panel__kicker">WELCOME BACK</span>
            <h2>登录校园账号</h2>
            <p>通过学校统一身份认证继续</p>
          </div>

          <div className="login-panel__notice">
            <span><LockKeyhole size={18} /></span>
            <p>
              账号与密码只在<strong>学校官方登录页</strong>输入。课迹不会读取、记录或上传密码。
            </p>
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
            {busy ? <LoaderCircle size={19} className="spin" /> : <ShieldCheck size={19} />}
            {busy ? '正在打开学校登录页…' : '前往统一身份认证'}
            {!busy && <ArrowRight size={18} className="primary-button__trailing" />}
          </button>

          <div className="login-divider"><span>或</span></div>

          <button className="secondary-button secondary-button--wide" onClick={onDemo} disabled={busy}>
            <Sparkles size={18} />
            先看看演示界面
          </button>

          {canOpenOffline && (
            <button className="offline-link" onClick={onOffline} disabled={busy}>
              <CalendarCheck2 size={17} />
              查看 {offlineProfile?.displayName ?? '最近账号'} 的离线课表
              <ArrowRight size={15} />
            </button>
          )}

          <p className="login-legal">
            继续即表示你同意仅在个人设备上访问本人校园数据。本应用不是学校官方产品。
          </p>
        </div>

        <div className="login-checks">
          <span><Check size={14} /> 无自建服务器</span>
          <span><Check size={14} /> 本地会话</span>
          <span><Check size={14} /> 密码零接触</span>
        </div>
      </section>
    </main>
  );
}
