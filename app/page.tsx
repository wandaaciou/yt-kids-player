import Link from "next/link";

export default function Home() {
  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="主導覽">
        <div className="brand-mark">
          <span className="play-badge" aria-hidden="true" />
          <strong>Sauncai Kids</strong>
        </div>
      </nav>

      <section className="hero-band route-hero">
        <div>
          <p className="eyebrow">酸菜播放器</p>
          <h1>請選擇要開啟的頁面。</h1>
        </div>
      </section>

      <section className="route-grid" aria-label="頁面選擇">
        <Link href="/parent">
          <span>家長設定頁</span>
          <strong>/parent</strong>
        </Link>
        <Link href="/kids">
          <span>酸菜觀看頁</span>
          <strong>/kids</strong>
        </Link>
      </section>
    </main>
  );
}
