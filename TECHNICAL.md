# 📋 技術仕様書 - 卒業研究進捗チェッカー

## 🏗️ システム概要

### アーキテクチャ概要
Chrome拡張機能として実装された、研究進捗の自動分析システムです。

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension                           │
├─────────────────────────────────────────────────────────────────┤
│  Background Service Worker (background.js)                     │
│  ├─ アイコンクリック処理                                          │
│  ├─ 学生ID管理                                                   │
│  ├─ URL設定チェック                                              │
│  ├─ 動的スクリプト注入                                           │
│  └─ ページ起動                                                   │
│                           │                                     │
│  Configuration (config.js)                                     │
│  ├─ URL設定管理                                                 │
│  ├─ アプリケーション定数                                         │
│  └─ UI設定                                                      │
│                           │                                     │
│  Content Injection (execute.js)                                │
│  ├─ CSP回避                                                     │
│  ├─ スクリプト注入                                               │
│  └─ DOM操作                                                     │
│                           │                                     │
│  Analysis Engine (analysis.js)                                 │
│  ├─ API通信                                                     │
│  ├─ データ分析                                                   │
│  ├─ UI生成                                                      │
│  ├─ シミュレーション                                             │
│  └─ イベント処理                                                 │
│                           │                                     │
│  Options Page (options.html/js)                                │
│  ├─ 設定保存                                                     │
│  └─ ユーザー設定                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 技術スタック
- **言語**: JavaScript (ES6+)
- **フレームワーク**: Chrome Extensions API (Manifest V3)
- **ライブラリ**: jQuery 3.6.1
- **データ通信**: jQuery Ajax
- **UI**: Vanilla CSS + JavaScript
- **設定管理**: ファイルベース設定

## 🛠️ コンポーネント詳細

### 1. Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "卒業研究 進捗チェッカー",
  "version": "2.0",
  "permissions": [
    "activeTab",        // アクティブタブへのアクセス
    "scripting",        // 動的スクリプト注入
    "storage"           // 設定データ保存
  ],
  "host_permissions": [
    "*://*/*"           // 全サイトアクセス権限
  ],
  "background": {
    "service_worker": "background.js"
  },
  "web_accessible_resources": [
    {
      "resources": ["analysis.js", "config.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

**設計上の特徴**:
- content_scriptsを使用せず、動的注入方式を採用
- 汎用的なhost_permissionsで柔軟なURL対応
- 最小限の権限で最大限の機能を実現

### 2. Configuration System (config.js)

```javascript
// 設定システムの中核
const CONFIG = {
  // Base URL (要設定)
  BASE_URL: '', // 運用時に実際のURLを設定
  
  // API endpoints
  ENDPOINTS: {
    REPORT_PAGE: '/report.html',
    API_MEMBER: '/api/lab/member'
  },
  
  // Application constants
  RULES: {
    REQUIRED_REPORTS: 123,    // 必要報告数
    ALLOWED_DAYS_OFF: 31,     // 許可休み日数
    START_YEAR: 2025,         // 開始年
    START_MONTH: 4,           // 開始月
    START_DAY: 10,            // 開始日
    DEADLINE_HOUR: 9,         // 締切時刻
    TOTAL_WEEKDAYS: 154       // 総平日数
  },
  
  // UI constants
  COLORS: {
    SUCCESS: '#16a34a',       // 成功
    WARNING: '#d97706',       // 警告
    ERROR: '#dc2626',         // エラー
    INFO: '#3b82f6',          // 情報
    NEUTRAL: '#6b7280'        // 中立
  }
};
```

**責務**:
- 一元的な設定管理
- URL秘匿化の実現
- アプリケーション定数の管理
- 環境固有設定の分離

### 3. Background Service Worker (background.js)

```javascript
// 動的注入システム
importScripts('config.js');

chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.sync.get("studentId", async ({ studentId }) => {
    if (studentId) {
      // URL設定チェック
      if (!CONFIG.BASE_URL) {
        alert('URLが設定されていません。config.jsを確認してください。');
        return;
      }
      
      // ページを開き、動的にスクリプトを注入
      const url = `${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.REPORT_PAGE}?id=${studentId}`;
      const newTab = await chrome.tabs.create({ url: url });
      
      // ページロード完了後の注入処理
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          injectScripts(newTab.id);
        }
      });
    } else {
      chrome.runtime.openOptionsPage();
    }
  });
});

async function injectScripts(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['config.js']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['execute.js']
    });
  } catch (error) {
    console.error('スクリプト注入エラー:', error);
  }
}
```

**責務**:
- 拡張機能アイコンクリック処理
- 学生ID存在チェック
- URL設定状態の検証
- 動的スクリプト注入の管理
- エラーハンドリング

### 4. Content Injection (execute.js)

```javascript
// CSP制限を回避するためのスクリプト注入
function injectAnalysisScript() {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('analysis.js');
  script.onload = function() {
    console.log('analysis.jsが正常に読み込まれました');
    script.remove(); // メモリリーク防止
  };
  script.onerror = function() {
    console.error('analysis.jsの読み込みに失敗しました');
    alert('進捗チェッカーの初期化に失敗しました。');
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// DOM準備完了を待って実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectAnalysisScript);
} else {
  injectAnalysisScript();
}
```

**責務**:
- CSP (Content Security Policy) 回避
- 分析スクリプトの安全な注入
- DOM準備完了の検知
- エラーハンドリング

### 5. Analysis Engine (analysis.js)

#### 5.1 データ取得システム

```javascript
// 並列データ取得システム
async function fetchProgressData(code, startDate, endDate) {
  const requests = [];
  let currentMonth = new Date(startDate);
  
  while (currentMonth <= endDate) {
    requests.push($.post(CONFIG.ENDPOINTS.API_MEMBER, JSON.stringify({
      Code: code,
      Year: currentMonth.getFullYear(),
      Month: currentMonth.getMonth() + 1
    })));
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  const results = await Promise.all(requests);
  return results.flatMap(d => d.dates || []);
}
```

#### 5.2 分析アルゴリズム

```javascript
// 期限判定アルゴリズム
function analyzeSubmissionStatus(day, rules) {
  const submitTime = new Date(day.first);
  const deadline = new Date(day.year, day.month - 1, day.day);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(rules.DEADLINE_HOUR, 0, 0, 0);
  
  return {
    isLate: submitTime >= deadline,
    isOnTime: submitTime < deadline,
    isMissing: !day.exists && isWeekday(day.week)
  };
}

// 点数計算システム
function calculateScores(data, rules) {
  let normal = 0, late = 0, missing = 0;
  
  data.forEach(day => {
    const status = analyzeSubmissionStatus(day, rules);
    if (status.isOnTime) normal++;
    if (status.isLate) late++;
    if (status.isMissing) missing++;
  });
  
  return {
    effectivePoints: normal + (late * 0.5),
    deductionPoints: (late * 0.5) + missing,
    finalScore: Math.max(0, rules.REQUIRED_REPORTS - finalDeduction)
  };
}
```

#### 5.3 UI生成システム

```javascript
// 動的UI生成
class DashboardGenerator {
  static createProgressBar(percentage, width = 20) {
    const filled = Math.round(percentage / 100 * width);
    const empty = width - filled;
    return '■'.repeat(filled) + '□'.repeat(empty);
  }
  
  static createDetailsList(items, renderFunction) {
    if (!items?.length) return '';
    return `
      <details>
        <summary>${items.length}件の詳細を表示</summary>
        <div style="max-height:120px;overflow-y:auto;">
          ${items.map(renderFunction).join('')}
        </div>
      </details>`;
  }
  
  static generateDashboard(analysisResult) {
    return `
      <div class="dashboard-container">
        ${this.createSummarySection(analysisResult)}
        ${this.createDetailsSection(analysisResult)}
        ${this.createSimulatorSection(analysisResult)}
      </div>`;
  }
}
```

#### 5.4 シミュレーションシステム

```javascript
// リアルタイムシミュレーション
class ProgressSimulator {
  constructor(baseData, constraints) {
    this.baseData = baseData;
    this.constraints = constraints;
    this.setupEventListeners();
  }
  
  validateInput(late, missing, vacation) {
    const total = late + missing + vacation;
    if (total > this.constraints.remainingWeekdays) {
      this.adjustLastInput(total - this.constraints.remainingWeekdays);
      return false;
    }
    return true;
  }
  
  calculatePrediction(late, missing, vacation) {
    const additionalDeduction = (late * 0.5) + missing;
    const totalDeduction = this.baseData.deductionPoints + additionalDeduction;
    const futureVacation = this.baseData.remainingVacation - vacation;
    const finalDeduction = Math.max(0, totalDeduction - futureVacation) + 
                          Math.max(0, -futureVacation);
    
    return {
      finalDeduction,
      finalScore: Math.max(0, CONFIG.RULES.REQUIRED_REPORTS - finalDeduction),
      breakdown: {
        current: this.baseData.deductionPoints,
        additional: additionalDeduction,
        total: totalDeduction,
        vacationOffset: futureVacation
      }
    };
  }
}
```

## 📊 データフロー

### 1. 初期化フロー
```
1. ユーザーがアイコンクリック
   ↓
2. background.js: 学生IDチェック
   ↓
3. background.js: URL設定チェック
   ↓
4. background.js: 新しいタブでページを開く
   ↓
5. background.js: ページロード完了を待機
   ↓
6. background.js: config.js注入
   ↓
7. background.js: execute.js注入
   ↓
8. execute.js: analysis.js注入
   ↓
9. analysis.js: 分析処理開始
```

### 2. 分析処理フロー
```
1. mainオブジェクト待機
   ↓
2. 学生ID取得
   ↓
3. 月別データ並列取得
   ↓
4. データ統合・分析
   ↓
5. ダッシュボードUI生成
   ↓
6. シミュレーター初期化
   ↓
7. イベントリスナー設定
   ↓
8. 初期表示完了
```

### 3. シミュレーション処理フロー
```
1. ユーザー入力検知
   ↓
2. 制約検証
   ↓
3. 超過時自動調整
   ↓
4. 予測計算実行
   ↓
5. 結果UI更新
   ↓
6. フィードバック表示
```

## 🎨 UI/UX設計

### デザインシステム

#### カラーパレット
```css
:root {
  --color-success: #16a34a;    /* 良好な状態 */
  --color-warning: #d97706;    /* 注意が必要 */
  --color-error: #dc2626;      /* 問題がある */
  --color-info: #3b82f6;       /* 情報表示 */
  --color-neutral: #6b7280;    /* 中立的な情報 */
  --color-bg-primary: #ffffff; /* 主要背景 */
  --color-bg-secondary: #f3f4f6; /* 副次背景 */
}
```

#### レイアウトシステム
```css
/* グリッドベースレイアウト */
.summary-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
}

.details-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
}

/* レスポンシブ対応 */
@media (max-width: 768px) {
  .details-content {
    grid-template-columns: 1fr;
  }
}
```

#### コンポーネント設計
```css
/* セクションコンポーネント */
.section {
  border: 2px solid var(--color-neutral-300);
  border-radius: 6px;
  margin-bottom: 15px;
  overflow: hidden;
}

.section__header {
  background: var(--color-bg-secondary);
  padding: 8px 15px;
  font-weight: 600;
  text-align: center;
}

.section__content {
  background: var(--color-bg-primary);
  padding: 15px;
}
```

## 🔧 開発環境

### 必要なツール
```bash
# 基本開発環境
- Google Chrome (最新版)
- Visual Studio Code
- Chrome DevTools

# 推奨拡張機能
- JavaScript (ES6) code snippets
- Chrome Extension Developer Tools
```

### デバッグ環境
```javascript
// デバッグ用設定
const DEBUG_MODE = true;

function debugLog(message, data) {
  if (DEBUG_MODE) {
    console.log(`[進捗チェッカー] ${message}`, data);
  }
}

// パフォーマンス測定
function measurePerformance(label, fn) {
  console.time(label);
  const result = fn();
  console.timeEnd(label);
  return result;
}
```

### テスト方法
```javascript
// 単体テスト例
function testCalculateScores() {
  const testData = [
    { exists: true, first: '2025-07-15T08:00:00Z', year: 2025, month: 7, day: 15 },
    { exists: true, first: '2025-07-16T10:00:00Z', year: 2025, month: 7, day: 16 },
    { exists: false, year: 2025, month: 7, day: 17, week: 'Monday' }
  ];
  
  const result = calculateScores(testData, CONFIG.RULES);
  console.assert(result.effectivePoints === 1.5, 'effectivePoints calculation failed');
  console.assert(result.deductionPoints === 1.5, 'deductionPoints calculation failed');
}
```

## 🚀 デプロイメント

### 開発版デプロイ
```bash
# 1. ソースコード準備
cd sotsuken-checker/

# 2. config.js設定
# BASE_URL を実際のURLに設定

# 3. Chrome拡張機能として読み込み
# chrome://extensions/ → 開発者モード → パッケージ化されていない拡張機能を読み込む
```

### 本番版パッケージング
```bash
# 1. 本番用設定
# - console.log削除
# - デバッグコード削除
# - 最適化

# 2. ZIPパッケージ作成
zip -r sotsuken-checker-v2.0.zip sotsuken-checker/ \
  --exclude "*.git*" "*.DS_Store*" "*node_modules*"

# 3. 配布
# - config.js内のBASE_URLを空にして配布
# - 実際のURLは別途提供
```

## 🔒 セキュリティ

### データ保護
```javascript
// 機密データの扱い
class SecureStorage {
  static encrypt(data) {
    // 本番環境では適切な暗号化を実装
    return btoa(JSON.stringify(data));
  }
  
  static decrypt(encryptedData) {
    try {
      return JSON.parse(atob(encryptedData));
    } catch {
      return null;
    }
  }
}

// 入力値検証
function validateStudentId(id) {
  return /^[a-zA-Z0-9]{3,20}$/.test(id);
}

// XSS対策
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}
```

### CSP対応
```javascript
// Content Security Policy 回避戦略
// 1. web_accessible_resources でリソースを公開
// 2. executeScript API で動的注入
// 3. inline script を避けて外部ファイル使用
```

## 📈 パフォーマンス最適化

### メモリ管理
```javascript
// メモリリーク防止
class ResourceManager {
  constructor() {
    this.listeners = new Map();
    this.timers = new Set();
  }
  
  addListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.listeners.set(element, { event, handler });
  }
  
  cleanup() {
    // リスナー削除
    this.listeners.forEach((info, element) => {
      element.removeEventListener(info.event, info.handler);
    });
    this.listeners.clear();
    
    // タイマー削除
    this.timers.forEach(timer => clearInterval(timer));
    this.timers.clear();
  }
}
```

### API最適化
```javascript
// リクエストキャッシュ
class APICache {
  constructor(maxAge = 300000) { // 5分
    this.cache = new Map();
    this.maxAge = maxAge;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.maxAge) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}
```

## 🐛 既知の問題と対策

### 1. 非同期タイミング問題
```javascript
// 解決策: Promiseベースの待機システム
async function waitForCondition(checkFn, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (checkFn()) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout'));
      }
    }, 100);
  });
}
```

### 2. DOM操作競合
```javascript
// 解決策: MutationObserver使用
class SafeDOMManager {
  constructor() {
    this.observer = new MutationObserver(this.handleMutations.bind(this));
  }
  
  observe(target) {
    this.observer.observe(target, {
      childList: true,
      subtree: true
    });
  }
  
  handleMutations(mutations) {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        this.reinitializeIfNeeded();
      }
    });
  }
}
```

### 3. エラーハンドリング
```javascript
// グローバルエラーハンドラ
window.addEventListener('error', (event) => {
  console.error('進捗チェッカーエラー:', event.error);
  // ユーザーフレンドリーなエラー表示
  showUserFriendlyError(event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未処理のPromise拒否:', event.reason);
  event.preventDefault();
});
```

## 📚 参考資料

### 公式ドキュメント
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 ガイド](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Content Security Policy](https://developer.mozilla.org/docs/Web/HTTP/CSP)

### 開発リソース
- [MDN Web Docs](https://developer.mozilla.org/)
- [jQuery API Documentation](https://api.jquery.com/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

### 設計参考
- [JavaScript Design Patterns](https://addyosmani.com/resources/essentialjsdesignpatterns/book/)
- [Web Components Best Practices](https://developers.google.com/web/fundamentals/web-components/best-practices)

---

**技術仕様書 v2.0**  
**最終更新**: 2025年7月22日  
**対象バージョン**: Chrome拡張機能 v2.0  
**作成者**: 進捗チェッカー開発チーム