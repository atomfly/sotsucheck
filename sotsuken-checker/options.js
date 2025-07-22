// 保存ボタンがクリックされたらIDを保存する
document.getElementById('save').addEventListener('click', () => {
  const reportId = document.getElementById('reportId').value;
  chrome.storage.sync.set({ studentId: reportId }, function() {
    // 保存されたことをユーザーに知らせる
    const status = document.getElementById('status');
    status.textContent = '保存しました！';
    setTimeout(() => {
      status.textContent = '';
    }, 1500);
  });
});

// ページを開いたときに、保存済みのIDを入力欄に表示する
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(['studentId'], function(result) {
    if (result.studentId) {
      document.getElementById('reportId').value = result.studentId;
    }
  });
});
