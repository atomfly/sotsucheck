// 外部スクリプトファイル（analysis.js）を挿入してCSPの制限を回避
(function() {
  console.log("🔧 execute.js が実行されました");

  // 重複実行を防ぐためのフラグ
  if (window.progressCheckerExecuted) {
    console.log("ℹ️ 進捗チェッカーは既に実行済みです。再実行をスキップします。");
    return;
  }
  window.progressCheckerExecuted = true;

  async function injectScripts() {
    try {
      console.log("📥 スクリプトの注入を開始します");
      
      // chrome.runtime が利用可能かチェック
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
        console.error("❌ Chrome拡張機能APIが利用できません");
        showUserMessage('Chrome拡張機能APIにアクセスできません。ページを再読み込みしてください。', 'error');
        return;
      }
      
      // 既存のスクリプトがあれば削除
      const existingConfigScript = document.querySelector('script[data-progress-checker="config"]');
      if (existingConfigScript) {
        console.log("🧹 既存のconfig.jsスクリプトを削除します");
        existingConfigScript.remove();
      }
      
      const existingAnalysisScript = document.querySelector('script[data-progress-checker="analysis"]');
      if (existingAnalysisScript) {
        console.log("🧹 既存のanalysis.jsスクリプトを削除します");
        existingAnalysisScript.remove();
      }
      
      // 1. まずconfig.jsを注入
      console.log("📄 config.js を注入します");
      await injectScript('config.js', 'config');
      
      // 少し待ってからanalysis.jsを注入
      setTimeout(async () => {
        console.log("📄 analysis.js を注入します");
        await injectScript('analysis.js', 'analysis');
      }, 200);
      
    } catch (error) {
      console.error("❌ injectScripts でエラーが発生しました:", error);
      showUserMessage('予期しないエラーが発生しました。', 'error');
    }
  }

  function injectScript(filename, type) {
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL(filename);
        script.setAttribute('data-progress-checker', type);
        
        script.onload = function() {
          console.log(`✅ ${filename}が正常に読み込まれました`);
          if (type === 'analysis') {
            showUserMessage('進捗チェッカーが正常に開始されました。', 'success');
          }
          script.remove();
          resolve();
        };
        
        script.onerror = function(error) {
          console.error(`❌ ${filename}の読み込みに失敗しました:`, error);
          if (type === 'analysis') {
            showUserMessage('進捗チェッカーの初期化に失敗しました。ページを再読み込みしてから再度お試しください。', 'error');
          }
          reject(error);
        };
        
        console.log(`📄 DOM要素に${filename}スクリプトを追加します`);
        (document.head || document.documentElement).appendChild(script);
        
      } catch (error) {
        console.error(`❌ ${filename} 注入でエラーが発生しました:`, error);
        reject(error);
      }
    });
  }

  // ユーザーへの通知機能
  function showUserMessage(message, type = 'info') {
    console.log(`💬 ユーザーメッセージ (${type}):`, message);
    
    // 既存のメッセージがあれば削除
    const existingMessage = document.getElementById('progress-checker-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    const colors = {
      success: { bg: '#dcfce7', border: '#16a34a', text: '#166534' },
      error: { bg: '#fee2e2', border: '#dc2626', text: '#dc2626' },
      info: { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' }
    };
    
    const color = colors[type] || colors.info;
    
    const messageDiv = document.createElement('div');
    messageDiv.id = 'progress-checker-message';
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: ${color.bg};
      border: 2px solid ${color.border};
      padding: 12px 16px;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 14px;
      color: ${color.text};
      z-index: 10000;
      max-width: 400px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    messageDiv.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">${icon} 進捗チェッカー</div>
      <div>${message}</div>
    `;
    
    document.body.appendChild(messageDiv);
    
    // 5秒後に自動で削除（エラーの場合は10秒）
    const timeout = type === 'error' ? 10000 : 5000;
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, timeout);
  }

  // ページの状態をチェック
  function checkPageState() {
    console.log("🔍 ページの状態をチェックします");
    console.log("📄 readyState:", document.readyState);
    console.log("🌐 URL:", window.location.href);
    console.log("📜 タイトル:", document.title);
    
    // mainオブジェクトが存在するかチェック
    if (typeof main !== 'undefined') {
      console.log("✅ mainオブジェクトが見つかりました:", main);
    } else {
      console.log("⚠️ mainオブジェクトがまだ見つかりません");
    }
    
    // jQueryが利用可能かチェック
    if (typeof $ !== 'undefined') {
      console.log("✅ jQueryが利用可能です");
    } else {
      console.log("⚠️ jQueryが利用できません");
    }
  }

  // 初期チェック実行
  checkPageState();

  // ページが読み込まれた後にスクリプトを挿入
  if (document.readyState === 'loading') {
    console.log("⏳ ページ読み込み中。DOMContentLoaded を待機します。");
    document.addEventListener('DOMContentLoaded', () => {
      console.log("✅ DOMContentLoaded イベントが発生しました");
      checkPageState();
      setTimeout(injectScripts, 500); // 少し待ってから実行
    });
  } else {
    console.log("✅ ページは既に読み込み済みです。すぐにスクリプトを注入します。");
    // ページが既に読み込まれている場合は少し待ってから実行
    setTimeout(injectScripts, 100);
  }
})();
