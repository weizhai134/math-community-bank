import { useEffect } from 'react';
import type { Route } from './lib/router';
import { navigate, useHashRoute } from './lib/router';
import { filterDueWrong, rankForXp } from './domain/rules';
import { useAppStore } from './store/useAppStore';
import { DataPanel } from './components/DataPanel';
import { PlayPage } from './pages/PlayPage';
import { HomePage } from './pages/HomePage';
import { MapPage } from './pages/MapPage';
import { LevelDetailPage } from './pages/LevelDetailPage';
import { ResultPage } from './pages/ResultPage';
import { WrongBookPage } from './pages/WrongBookPage';
import { FlashcardsPage } from './pages/FlashcardsPage';
import { ExamPage } from './pages/ExamPage';
import { ExamPlayPage } from './pages/ExamPlayPage';
import { ExamResultPage } from './pages/ExamResultPage';
import { CommunityListPage } from './pages/CommunityListPage';
import { CommunityUploadPage } from './pages/CommunityUploadPage';
import { CommunityPlayPage } from './pages/CommunityPlayPage';
import { CommunityResultPage } from './pages/CommunityResultPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';

function Header({ route }: { route: Route }): JSX.Element {
  const profile = useAppStore((state) => state.profile);
  const wrongItems = useAppStore((state) => state.wrongItems);
  const setDataOpen = useAppStore((state) => state.setDataOpen);
  const due = filterDueWrong(wrongItems).length;
  const rank = profile ? rankForXp(profile.totalXp) : null;
  const mapActive = route.name === 'map' || route.name === 'level';
  const wrongActive = route.name === 'wrong';
  const flashcardsActive = route.name === 'flashcards';
  const communityActive = route.name.startsWith('community');

  return (
    <header className="app-header">
      <div className="header-inner">
        <button className="brand" onClick={() => navigate('/')} aria-label="高数闯关首页">
          <span className="brand-mark">∫</span>
          <span className="brand-text">
            <strong>高数闯关</strong>
            <small>同济第八版 · 上册</small>
          </span>
        </button>
        <nav className="main-nav" aria-label="主导航">
          <button className={route.name === 'home' ? 'active' : ''} onClick={() => navigate('/')}>
            首页
          </button>
          <button className={mapActive ? 'active' : ''} onClick={() => navigate('/map')}>
            章节地图
          </button>
          <button className={wrongActive ? 'active' : ''} onClick={() => navigate('/wrong')}>
            错题本
            {due > 0 ? <span className="nav-dot" aria-label={`${due} 道到期`} /> : null}
          </button>
          <button
            className={flashcardsActive ? 'active' : ''}
            onClick={() => navigate('/flashcards')}
          >
            闪卡
          </button>
          <button
            className={communityActive ? 'active' : ''}
            onClick={() => navigate('/community')}
          >
            社区
          </button>
        </nav>
        <div className="header-side">
          {rank && profile ? (
            <button className="rank-chip" onClick={() => navigate('/')} title="查看段位进度">
              <span>{rank.title}</span>
              <strong>{profile.totalXp} XP</strong>
            </button>
          ) : null}
          <button className="data-button" onClick={() => setDataOpen(true)} title="数据与题库">
            数据
          </button>
        </div>
      </div>
    </header>
  );
}

function Toast(): JSX.Element | null {
  const toast = useAppStore((state) => state.toast);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast}
    </div>
  );
}

function NotFound(): JSX.Element {
  return (
    <div className="page">
      <div className="empty-state">
        <h1>页面不存在</h1>
        <p>地址可能已失效。回到首页或章节地图继续。</p>
        <div className="inline-actions">
          <button className="button primary" onClick={() => navigate('/')}>
            回到首页
          </button>
          <button className="button ghost" onClick={() => navigate('/map')}>
            章节地图
          </button>
        </div>
      </div>
    </div>
  );
}

function RouteView({ route }: { route: Route }): JSX.Element {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'map':
      return <MapPage />;
    case 'level':
      return <LevelDetailPage levelId={route.levelId} />;
    case 'play':
      return <PlayPage />;
    case 'result':
      return <ResultPage id={route.id} />;
    case 'wrong':
      return <WrongBookPage />;
    case 'flashcards':
      return <FlashcardsPage />;
    case 'exam':
      return <ExamPage />;
    case 'examPlay':
      return <ExamPlayPage />;
    case 'examResult':
      return <ExamResultPage />;
    case 'community':
      return <CommunityListPage />;
    case 'communityUpload':
      return <CommunityUploadPage />;
    case 'communityMine':
      return <MySubmissionsPage />;
    case 'communityPlay':
      return <CommunityPlayPage />;
    case 'communityResult':
      return <CommunityResultPage />;
    default:
      return <NotFound />;
  }
}

export default function App(): JSX.Element {
  const route = useHashRoute();
  const loading = useAppStore((state) => state.loading);
  const bootError = useAppStore((state) => state.bootError);
  const bootstrap = useAppStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">∫</div>
        <h1>高数闯关</h1>
        <p>正在打开本地数据库…</p>
        <div className="boot-bar">
          <span />
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="boot-screen boot-error">
        <div className="boot-mark">!</div>
        <h1>本地数据库没有打开</h1>
        <p>{bootError}</p>
        <p className="small-note">
          请确认浏览器未禁用 IndexedDB，或换一个普通窗口（非无痕模式）后重试。
        </p>
        <button className="button primary" onClick={() => void bootstrap()}>
          重试
        </button>
      </div>
    );
  }

  if (route.name === 'play' || route.name === 'communityPlay' || route.name === 'examPlay') {
    return (
      <>
        <RouteView route={route} />
        <Toast />
      </>
    );
  }

  return (
    <div className="app-shell">
      <Header route={route} />
      <main className="app-main">
        <RouteView route={route} />
      </main>
      <DataPanel />
      <Toast />
    </div>
  );
}
