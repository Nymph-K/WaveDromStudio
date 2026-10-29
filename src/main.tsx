import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { useAppStore } from './state/appStore';

if (import.meta.env.DEV) {
  (window as typeof window & { __WDS_STORE__?: typeof useAppStore }).__WDS_STORE__ = useAppStore;
}

createRoot(document.getElementById('root')!).render(<App />);
