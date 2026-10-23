import { LoaderCircle } from 'lucide-react';
import { Logo } from './Logo';

export function BootScreen() {
  return (
    <main className="boot-screen">
      <div className="boot-screen__halo" />
      <Logo />
      <div className="boot-screen__status">
        <LoaderCircle size={17} className="spin" />
        正在恢复校园会话
      </div>
      <p>你的数据只在本机与学校系统之间流转</p>
    </main>
  );
}
