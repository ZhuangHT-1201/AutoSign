import {
  CalendarClock,
  Database,
  Github,
  LogOut,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import type { Profile, ResolvedConnectionMode, Week } from '../types';
import { formatFullDate, parseLocalDate } from '../lib/date';

interface SettingsDialogProps {
  open: boolean;
  profile: Profile | null;
  mode: ResolvedConnectionMode;
  week: Week | undefined;
  cachedAt: string | null;
  offline: boolean;
  onClose: () => void;
  onLogout: () => void;
  onClearData: () => void;
}

export function SettingsDialog({
  open,
  profile,
  mode,
  week,
  cachedAt,
  offline,
  onClose,
  onLogout,
  onClearData,
}: SettingsDialogProps) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
        <header>
          <div><span>SETTINGS</span><h2>设置与账户</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="关闭设置"><X size={20} /></button>
        </header>

        <div className="profile-card">
          <span className="profile-card__avatar">{(profile?.displayName ?? '课').slice(0, 1)}</span>
          <div><strong>{profile?.displayName ?? '校园用户'}</strong><p>{profile?.studentId ? `学号 ${profile.studentId}` : '个人校园账户'}</p></div>
          <span className="profile-card__mode">{offline ? '离线' : mode === 'webvpn' ? 'WebVPN' : '直连'}</span>
        </div>

        <div className="settings-list">
          <div className="settings-row">
            <span><Smartphone size={18} /></span>
            <div><strong>连接方式</strong><small>{mode === 'webvpn' ? '学校 WebVPN 会话' : '校园网络直连'}</small></div>
            <em>{mode === 'webvpn' ? 'WebVPN' : '直连'}</em>
          </div>
          <div className="settings-row">
            <span><CalendarClock size={18} /></span>
            <div><strong>当前课表</strong><small>{week ? `${week.name} · ${formatFullDate(parseLocalDate(week.startDate))}` : '暂无课表'}</small></div>
          </div>
          <div className="settings-row">
            <span><Database size={18} /></span>
            <div><strong>本地缓存</strong><small>{cachedAt ? `更新于 ${new Date(cachedAt).toLocaleString('zh-CN')}` : '尚无缓存'}</small></div>
          </div>
          <div className="settings-row">
            <span><ShieldCheck size={18} /></span>
            <div><strong>隐私与安全</strong><small>不保存密码，会话由设备原生 Cookie 管理</small></div>
          </div>
          <div className="settings-row">
            <span><Github size={18} /></span>
            <div><strong>开源许可</strong><small>MIT License · 课迹 0.1.1</small></div>
          </div>
        </div>

        <div className="settings-actions">
          <button className="danger-quiet-button" onClick={onClearData}><Trash2 size={16} /> 清除离线缓存</button>
          <button className="logout-button" onClick={onLogout}><LogOut size={17} /> 退出登录</button>
        </div>
        <p className="settings-footnote">课迹不是学校官方产品。请妥善保管个人设备与校园账号。</p>
      </section>
    </div>
  );
}
