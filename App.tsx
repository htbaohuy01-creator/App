
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { GeoPoint, PatrolLog, UserRole, AnalysisResult } from './types';
import { COMPANY_CHECKPOINTS, COLORS } from './constants';
import { analyzePatrolLogs } from './services/geminiService';
import RouteMap from './components/RouteMap';

// --- Global Header Component ---
const Navbar: React.FC<{ role: UserRole; setRole: (r: UserRole) => void; isOnline: boolean }> = ({ role, setRole, isOnline }) => (
  <nav className="bg-slate-900 text-white p-4 sticky top-0 z-[2000] shadow-lg flex justify-between items-center border-b border-slate-800">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
        <i className="fas fa-shield-alt text-xl"></i>
      </div>
      <div>
        <h1 className="font-bold text-lg tracking-tight">VIGILANT</h1>
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Patrol System</p>
          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
          <div className="flex items-center gap-1">
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-orange-500'}`}></div>
            <span className={`text-[8px] font-bold uppercase ${isOnline ? 'text-green-500' : 'text-orange-500'}`}>
              {isOnline ? 'Trực tuyến' : 'Ngoại tuyến'}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
      <button 
        onClick={() => setRole(UserRole.GUARD)}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${role === UserRole.GUARD ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
      >
        Bảo vệ
      </button>
      <button 
        onClick={() => setRole(UserRole.SUPERVISOR)}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${role === UserRole.SUPERVISOR ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
      >
        Admin
      </button>
    </div>
  </nav>
);

// --- Guard View Component ---
const GuardPanel: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  const [isPatrolling, setIsPatrolling] = useState(false);
  const [currentLog, setCurrentLog] = useState<PatrolLog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // Load active patrol if exists in local storage
  useEffect(() => {
    const activeLog = localStorage.getItem('active_patrol');
    if (activeLog) {
      const parsed = JSON.parse(activeLog);
      setCurrentLog(parsed);
      setIsPatrolling(true);
      resumePatrol(parsed);
    }
  }, []);

  // Save current log periodically to prevent data loss
  useEffect(() => {
    if (isPatrolling && currentLog) {
      localStorage.setItem('active_patrol', JSON.stringify(currentLog));
    }
  }, [currentLog, isPatrolling]);

  // Sync animation when coming back online
  useEffect(() => {
    if (isOnline && isPatrolling) {
      setIsSyncing(true);
      const timer = setTimeout(() => setIsSyncing(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const resumePatrol = (log: PatrolLog) => {
    if (!navigator.geolocation) return;
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handlePositionUpdate(position),
      (err) => setError("Lỗi GPS: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  const handlePositionUpdate = (position: GeolocationPosition) => {
    const newPoint: GeoPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      timestamp: position.timestamp,
      accuracy: position.coords.accuracy
    };

    setCurrentLog(prev => {
      if (!prev) return null;
      
      const updatedCheckpoints = prev.checkpoints.map(cpStatus => {
        if (cpStatus.reachedAt) return cpStatus;
        const target = COMPANY_CHECKPOINTS.find(c => c.id === cpStatus.checkpointId);
        if (target) {
          const dist = Math.sqrt(Math.pow(target.lat - newPoint.lat, 2) + Math.pow(target.lng - newPoint.lng, 2));
          if (dist < 0.0001) {
            return { ...cpStatus, reachedAt: Date.now() };
          }
        }
        return cpStatus;
      });

      return {
        ...prev,
        points: [...prev.points, newPoint],
        checkpoints: updatedCheckpoints
      };
    });
  };

  const startPatrol = () => {
    if (!navigator.geolocation) {
      setError("Thiết bị không hỗ trợ định vị GPS");
      return;
    }

    const newLog: PatrolLog = {
      id: Math.random().toString(36).substr(2, 9),
      guardId: 'G-001',
      guardName: 'Alex Security',
      startTime: Date.now(),
      points: [],
      checkpoints: COMPANY_CHECKPOINTS.map(cp => ({ checkpointId: cp.id })),
      status: 'active'
    };

    setCurrentLog(newLog);
    setIsPatrolling(true);
    localStorage.setItem('active_patrol', JSON.stringify(newLog));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handlePositionUpdate(position),
      (err) => setError("Lỗi GPS: " + err.message),
      { enableHighAccuracy: true }
    );
  };

  const stopPatrol = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (currentLog) {
      const finalLog = { ...currentLog, endTime: Date.now(), status: 'completed' as const };
      localStorage.setItem(`patrol_${finalLog.id}`, JSON.stringify(finalLog));
      localStorage.removeItem('active_patrol');
    }

    setIsPatrolling(false);
    setCurrentLog(null);
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  return (
    <div className="max-w-md mx-auto p-5 space-y-6 pb-24">
      {/* Offline Alert */}
      {!isOnline && (
        <div className="bg-orange-500 text-white p-3 rounded-2xl flex items-center justify-between shadow-lg shadow-orange-500/20 animate-pulse">
          <div className="flex items-center gap-2">
            <i className="fas fa-wifi-slash"></i>
            <span className="text-xs font-bold">Chế độ ngoại tuyến: Dữ liệu đang được lưu cục bộ</span>
          </div>
        </div>
      )}

      {/* Syncing Alert */}
      {isSyncing && isOnline && (
        <div className="bg-green-600 text-white p-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-green-600/20">
          <i className="fas fa-sync-alt animate-spin"></i>
          <span className="text-xs font-bold">Đang đồng bộ hóa dữ liệu với hệ thống...</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 -mr-16 -mt-16 rounded-full opacity-50"></div>
        <div className="relative">
          <h2 className="text-2xl font-bold text-slate-800">Xin chào, Alex</h2>
          <p className="text-slate-500 text-sm mt-1">Ca làm việc: Sáng (08:00 - 16:00)</p>
          
          <div className="mt-6 flex items-center gap-4">
             <div className={`w-3 h-3 rounded-full ${isPatrolling ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
             <span className="text-sm font-semibold text-slate-700">
               Trạng thái: {isPatrolling ? 'Đang tuần tra' : 'Sẵn sàng'}
             </span>
          </div>
        </div>
      </div>

      <RouteMap 
        points={currentLog?.points || []} 
        checkpoints={COMPANY_CHECKPOINTS} 
      />

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Các điểm chốt</h3>
        <div className="space-y-4">
          {COMPANY_CHECKPOINTS.map((cp) => {
            const status = currentLog?.checkpoints.find(s => s.checkpointId === cp.id);
            const isReached = !!status?.reachedAt;
            return (
              <div key={cp.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isReached ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                    <i className={`fas ${isReached ? 'fa-check' : 'fa-map-marker-alt'}`}></i>
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${isReached ? 'text-slate-800' : 'text-slate-400'}`}>{cp.name}</p>
                    {isReached && <p className="text-[10px] text-green-500 font-medium">{new Date(status.reachedAt!).toLocaleTimeString()}</p>}
                  </div>
                </div>
                {!isReached && isPatrolling && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold animate-pulse">Đang tới</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-medium border border-red-100 flex items-center gap-3">
          <i className="fas fa-exclamation-circle text-lg"></i>
          {error}
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-5 z-[3000]">
        {!isPatrolling ? (
          <button 
            onClick={startPatrol}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 rounded-2xl shadow-xl shadow-blue-500/30 flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <i className="fas fa-play"></i>
            BẮT ĐẦU TUẦN TRA
          </button>
        ) : (
          <button 
            onClick={stopPatrol}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-red-500/30 flex items-center justify-center gap-3 transition-transform active:scale-95"
          >
            <i className="fas fa-stop"></i>
            KẾT THÚC TUẦN TRA
          </button>
        )}
      </div>
    </div>
  );
};

// --- Supervisor View Component ---
const SupervisorDashboard: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  const [logs, setLogs] = useState<PatrolLog[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<PatrolLog | null>(null);

  useEffect(() => {
    const stored = Object.keys(localStorage)
      .filter(key => key.startsWith('patrol_'))
      .map(key => JSON.parse(localStorage.getItem(key)!))
      .sort((a, b) => b.startTime - a.startTime);
    setLogs(stored);
  }, []);

  const handleAnalyze = async (log: PatrolLog) => {
    if (!isOnline) {
      alert("Bạn cần có kết nối internet để sử dụng tính năng phân tích AI.");
      return;
    }
    setIsAnalyzing(true);
    setSelectedLog(log);
    const result = await analyzePatrolLogs(log);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-5 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tổng lượt tuần</p>
          <h4 className="text-3xl font-black text-slate-800">{logs.length}</h4>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Đang trực</p>
          <h4 className="text-3xl font-black text-blue-600">1</h4>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Sự cố</p>
          <h4 className="text-3xl font-black text-red-500">0</h4>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Lịch sử tuần tra</h3>
          <span className="text-xs text-slate-400">Tổng cộng: {logs.length}</span>
        </div>
        
        {logs.length === 0 ? (
          <div className="p-12 text-center">
             <i className="fas fa-folder-open text-4xl text-slate-200 mb-4"></i>
             <p className="text-slate-400 font-medium">Chưa có dữ liệu tuần tra.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500">
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{log.guardName}</p>
                    <p className="text-xs text-slate-400">{new Date(log.startTime).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                   <div className="text-right">
                     <p className="text-xs font-bold text-slate-600">
                       {log.checkpoints.filter(c => c.reachedAt).length}/{log.checkpoints.length} CP
                     </p>
                     <p className="text-[10px] text-slate-400 uppercase font-black">Hoàn thành</p>
                   </div>
                   <button 
                    disabled={!isOnline}
                    onClick={() => handleAnalyze(log)}
                    className={`${!isOnline ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20'} text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center gap-2`}
                   >
                     {isAnalyzing && selectedLog?.id === log.id ? (
                        <i className="fas fa-circle-notch animate-spin"></i>
                     ) : (
                        <i className="fas fa-brain"></i>
                     )}
                     Phân tích AI
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {analysis && selectedLog && (
        <div className="bg-slate-900 text-white p-8 rounded-3xl border border-slate-800 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <i className="fas fa-robot text-lg"></i>
              </div>
              <div>
                <h3 className="text-lg font-bold">Báo cáo AI Security</h3>
                <p className="text-xs text-slate-400">ID Lượt: {selectedLog.id}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-blue-400">{analysis.efficiency}%</div>
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">Hiệu suất</p>
            </div>
          </div>

          <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700">
            <p className="text-sm leading-relaxed text-slate-300 italic">"{analysis.summary}"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
               <h4 className="text-xs font-black text-red-400 uppercase tracking-widest flex items-center gap-2">
                 <i className="fas fa-exclamation-triangle"></i> Bất thường
               </h4>
               <ul className="space-y-2">
                 {analysis.anomalies.map((a, i) => (
                   <li key={i} className="text-xs bg-red-950/30 border border-red-900/50 p-2 rounded-lg flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                     {a}
                   </li>
                 ))}
               </ul>
            </div>
            <div className="space-y-3">
               <h4 className="text-xs font-black text-green-400 uppercase tracking-widest flex items-center gap-2">
                 <i className="fas fa-lightbulb"></i> Đề xuất cải thiện
               </h4>
               <ul className="space-y-2">
                 {analysis.recommendations.map((r, i) => (
                   <li key={i} className="text-xs bg-green-950/30 border border-green-900/50 p-2 rounded-lg flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                     {r}
                   </li>
                 ))}
               </ul>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-800">
            <button 
              onClick={() => setAnalysis(null)}
              className="text-xs text-slate-500 hover:text-white font-bold uppercase tracking-widest transition-colors"
            >
              Đóng báo cáo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App Entry ---
const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.GUARD);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen pb-20">
      <Navbar role={role} setRole={setRole} isOnline={isOnline} />
      <main className="container mx-auto">
        {role === UserRole.GUARD ? (
          <GuardPanel isOnline={isOnline} />
        ) : (
          <SupervisorDashboard isOnline={isOnline} />
        )}
      </main>
      
      {/* Tab bar for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around p-3 md:hidden z-[4000]">
        <button 
          onClick={() => setRole(UserRole.GUARD)}
          className={`flex flex-col items-center gap-1 transition-colors ${role === UserRole.GUARD ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <i className="fas fa-map-marked-alt text-lg"></i>
          <span className="text-[10px] font-bold">Tuần tra</span>
        </button>
        <button 
          onClick={() => setRole(UserRole.SUPERVISOR)}
          className={`flex flex-col items-center gap-1 transition-colors ${role === UserRole.SUPERVISOR ? 'text-blue-600' : 'text-slate-400'}`}
        >
          <i className="fas fa-chart-line text-lg"></i>
          <span className="text-[10px] font-bold">Quản lý</span>
        </button>
      </div>
    </div>
  );
};

export default App;
