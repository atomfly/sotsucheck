// Import configuration
importScripts('config.js');

chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log("📱 拡張機能アイコンがクリックされました");
    
    const result = await chrome.storage.sync.get("studentId");
    const studentId = result.studentId;
    
    console.log("💾 保存された学生ID:", studentId);
    
    if (studentId) {
      console.log("✅ 学生IDが見つかりました。研究報告ページを開きます。");
      
      // URLが設定されているかチェック
      if (!CONFIG.BASE_URL) {
        console.error("❌ URLが設定されていません");
        alert('URLが設定されていません。config.jsを確認してください。\nThe URL is not set. Please check config.js.');
        return;
      }
      
      const url = `${CONFIG.BASE_URL}${CONFIG.ENDPOINTS.REPORT_PAGE}?id=${studentId}`;
      console.log("🌐 開くURL:", url);
      
      try {
        // 新しいタブでページを開く
        const newTab = await chrome.tabs.create({ url: url });
        console.log("📂 新しいタブを作成しました。Tab ID:", newTab.id);
        
        // タイムアウト設定
        const timeout = setTimeout(() => {
          console.error("⏰ ページロードタイムアウト (30秒)");
        }, 30000);
        
        // ページが読み込まれるのを待ってからスクリプトを注入
        const listener = async (tabId, changeInfo, tabInfo) => {
          if (tabId === newTab.id) {
            console.log(`📊 Tab ${tabId} 状態変更:`, changeInfo.status, tabInfo.url);
            
            if (changeInfo.status === 'complete') {
              clearTimeout(timeout);
              chrome.tabs.onUpdated.removeListener(listener);
              console.log("✅ ページ読み込み完了。スクリプト注入を開始します。");
              
              // タブがまだ存在するかチェック
              try {
                await chrome.tabs.get(tabId);
                await injectScripts(tabId);
              } catch (error) {
                console.error("❌ タブアクセスエラー:", error);
              }
            }
          }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
        // タブが閉じられた場合のクリーンアップ
        const removeListener = (tabId) => {
          if (tabId === newTab.id) {
            clearTimeout(timeout);
            chrome.tabs.onUpdated.removeListener(listener);
            chrome.tabs.onRemoved.removeListener(removeListener);
            console.log("🧹 タブが閉じられました。リスナーをクリーンアップしました。");
          }
        };
        chrome.tabs.onRemoved.addListener(removeListener);
        
      } catch (tabError) {
        console.error("❌ タブ作成エラー:", tabError);
        alert('ページを開く際にエラーが発生しました。');
      }
      
    } else {
      console.log("⚙️ 学生IDが見つかりません。設定画面を開きます。");
      chrome.runtime.openOptionsPage();
    }
  } catch (error) {
    console.error("❌ 拡張機能アイコンクリック処理エラー:", error);
    alert('拡張機能でエラーが発生しました。');
  }
});

async function injectScripts(tabId) {
  try {
    console.log(`🚀 スクリプト注入開始 (Tab ID: ${tabId})`);
    
    // タブが有効かチェック
    const tab = await chrome.tabs.get(tabId);
    if (!tab || tab.discarded) {
      throw new Error('タブが無効または破棄されています');
    }
    
    console.log("📄 Tab URL:", tab.url);
    
    // 各スクリプトを順番に注入
    const scriptsToInject = [
      { file: 'config.js', name: 'CONFIG設定' },
      { file: 'execute.js', name: 'メイン実行スクリプト' }
    ];
    
    for (const script of scriptsToInject) {
      try {
        console.log(`📥 ${script.name} (${script.file}) を注入中...`);
        
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [script.file]
        });
        
        console.log(`✅ ${script.name} 注入完了`);
        
        // 各スクリプト間で少し待機
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (scriptError) {
        console.error(`❌ ${script.name} 注入エラー:`, scriptError);
        
        // config.jsは必須なので失敗したら停止
        if (script.file === 'config.js') {
          throw scriptError;
        }
      }
    }
    
    console.log("🎉 すべてのスクリプト注入が完了しました");
    
  } catch (error) {
    console.error(`❌ スクリプト注入エラー (Tab ID: ${tabId}):`, error);
    
    // 特定のエラーに対する対処
    if (error.message.includes('closed') || error.message.includes('discarded')) {
      console.log("ℹ️ タブが既に閉じられているため、注入をスキップします");
    } else if (error.message.includes('Cannot access')) {
      console.log("ℹ️ ページへのアクセス権限がありません");
    } else {
      // ユーザーに分かりやすいエラーメッセージを表示
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: showErrorMessage,
          args: ['🚨 進捗チェッカーの初期化に失敗しました。ページを再読み込みしてから再度お試しください。']
        });
      } catch (innerError) {
        console.error("❌ エラーメッセージ表示にも失敗:", innerError);
      }
    }
  }
}

// ページに直接実行される関数
function showErrorMessage(message) {
  console.log("🚨 エラーメッセージを表示:", message);
  
  // 既存のエラーメッセージがあれば削除
  const existingError = document.getElementById('progress-checker-error-bg');
  if (existingError) {
    existingError.remove();
  }
  
  const errorDiv = document.createElement('div');
  errorDiv.id = 'progress-checker-error-bg';
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fee2e2;
    border: 2px solid #fca5a5;
    padding: 15px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
    color: #dc2626;
    z-index: 10000;
    max-width: 350px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;
  errorDiv.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">⚠️ 進捗チェッカー</div>
    <div>${message}</div>
  `;
  
  document.body.appendChild(errorDiv);
  
  // 10秒後に自動で削除
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 10000);
}

// デバッグ用：サービスワーカー開始時のログ
console.log("🔧 進捗チェッカー背景スクリプトが開始されました");
