// analysis.js - ページのコンテキストで実行される分析処理
(async function(){
  try {
    console.log("進捗チェッカー: スクリプト開始");
    
    // Use configuration from config.js
    const RULES = CONFIG.RULES;
    
    console.log("進捗チェッカー: RULES設定完了", RULES);

    // mainオブジェクトが利用可能になるまで待機
    function waitForMain() {
      return new Promise((resolve, reject) => {
        console.log("進捗チェッカー: mainオブジェクトを待機中...");
        const startTime = Date.now();
        const timeout = 10000; // 10秒でタイムアウト
        
        const checkInterval = setInterval(() => {
          console.log("進捗チェッカー: mainオブジェクトをチェック中...", typeof main, main?.code);
          if (typeof main !== 'undefined' && main.code) {
            clearInterval(checkInterval);
            console.log("進捗チェッカー: mainオブジェクトが見つかりました", main.code);
            resolve();
          } else if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            console.error("進捗チェッカー: mainオブジェクトのタイムアウト");
            reject(new Error("mainオブジェクトが見つかりません。ページが完全に読み込まれるまでお待ちください。"));
          }
        }, 500);
      });
    }

    // mainオブジェクトが利用可能になるまで待機
    await waitForMain();

    const code = main.code;
    console.log("進捗チェッカー: 分析開始 code =", code);
    
    let container = document.getElementById('analysis-result-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'analysis-result-container';
      container.style.cssText = 'margin:20px;padding:20px;border:2px solid #484878;background-color:#f0f0f8;font-family:sans-serif;border-radius:8px;';
      document.body.appendChild(container);
    }
    container.innerHTML = '<h2 style="margin-top:0;color:#484878;">進捗状況を分析中...</h2>';
    container.scrollIntoView({behavior:'smooth'});

    console.log("進捗チェッカー: データ取得開始");
    const requests = [];
    const today = new Date();
    const startDate = new Date(RULES.START_YEAR, RULES.START_MONTH - 1, RULES.START_DAY);
    
    let currentMonth = new Date(startDate);
    currentMonth.setDate(1);
    while (currentMonth <= today) {
      console.log("進捗チェッカー: データ取得月", currentMonth.getFullYear(), currentMonth.getMonth() + 1);
      requests.push($.post(CONFIG.ENDPOINTS.API_MEMBER, JSON.stringify({
        Code: code,
        Year: currentMonth.getFullYear(),
        Month: currentMonth.getMonth() + 1
      })));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    console.log("進捗チェッカー: APIリクエスト数", requests.length);
    const results = await Promise.all(requests);
    const allData = results.flatMap(d => d.dates || []);
    console.log("進捗チェッカー: 取得データ件数", allData.length);

    let normal = 0, late = 0, vacationCount = 0, missingCount = 0, weekdaysPassed = 0;
    let lateDates = [], vacationDates = [], missingDates = [], allReportData = {};
    const todayCheck = new Date();
    todayCheck.setHours(0, 0, 0, 0);

    allData.forEach(day => {
      if (!day) return;
      const date = new Date(day.year, day.month - 1, day.day);
      const dateKey = `${day.year}-${day.month}-${day.day}`;
      allReportData[dateKey] = day;
      
      if (date < startDate || date > todayCheck) return;
      
      const isWeekday = !["Saturday", "Sunday", "Holiday"].includes(day.week);
      if (isWeekday) {
        weekdaysPassed++;
      }
      
      const isStartDate = date.getTime() === startDate.getTime();
      if (isStartDate) {
        normal++;
        return;
      }
      
      if (day.vacation) {
        vacationCount++;
        vacationDates.push({
          key: dateKey,
          date: `${day.year}/${day.month}/${day.day}`
        });
        return;
      }
      
      if (day.exists) {
        const first = new Date(day.first);
        const deadline = new Date(date);
        deadline.setDate(deadline.getDate() + 1);
        deadline.setHours(RULES.DEADLINE_HOUR, 0, 0, 0);
        if (first < deadline) {
          normal++;
        } else {
          late++;
          lateDates.push({
            key: dateKey,
            date: `${day.year}/${day.month}/${day.day}`,
            time: first.toLocaleString('ja-JP', {hour12: false})
          });
        }
      } else if (isWeekday) {
        missingCount++;
        missingDates.push({
          key: dateKey,
          date: `${day.year}/${day.month}/${day.day}`
        });
      }
    });

    // 計算
    const effectivePoints = normal + late * 0.5;
    const reportsNeeded = Math.max(0, RULES.REQUIRED_REPORTS - effectivePoints);
    const deductionPoints = late * 0.5 + missingCount;
    const remainingVacation = RULES.ALLOWED_DAYS_OFF - vacationCount;
    const finalDeduction = Math.max(0, deductionPoints - remainingVacation) + Math.max(0, -remainingVacation);
    const currentScore = Math.max(0, RULES.REQUIRED_REPORTS - finalDeduction);
    const currentScorePercent = ((currentScore / RULES.REQUIRED_REPORTS) * 100).toFixed(1);
    const remainingWeekdays = RULES.TOTAL_WEEKDAYS - weekdaysPassed;
    const progressPercent = Math.round(weekdaysPassed / RULES.TOTAL_WEEKDAYS * 100);
    const unitPercent = Math.round(effectivePoints / RULES.REQUIRED_REPORTS * 100);

    // プログレスバーの生成
    const createProgressBar = (percentage, width = 20) => {
      const filledBlocks = Math.round(percentage / 100 * width);
      const emptyBlocks = width - filledBlocks;
      return '■'.repeat(filledBlocks) + '□'.repeat(emptyBlocks);
    };

    // 詳細リストの作成
    const createDetailsList = (items, label, render) => {
      if (!items || items.length === 0) return '';
      return `
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;color:#0066cc;user-select:none;font-size:0.9em;">
            ${items.length}件の詳細を表示
          </summary>
          <div style="margin-top:8px;padding:8px;background:#f8f9fa;border-radius:4px;max-height:120px;overflow-y:auto;font-size:0.85em;">
            ${items.map(render).join('')}
          </div>
        </details>`;
    };

    // 成績シミュレーター
    const createSimulator = (deductionPoints, remainingVacation, remainingWeekdays) => {
      return `
        <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-top:15px;">
          <div style="margin-bottom:15px;font-size:1.1em;color:#374151;">
            🔮 成績シミュレーター (残り${remainingWeekdays}日で...)
          </div>
          
          <div style="margin-bottom:20px;padding:15px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
            <div style="font-size:1em;color:#374151;margin-bottom:15px;">もし、今後...</div>
            <div style="display:flex;gap:20px;align-items:center;justify-content:center;flex-wrap:wrap;">
              <label style="font-size:0.9em;color:#6b7280;display:flex;align-items:center;gap:8px;">
                ・遅延報告を 
                <input id="sim-late" type="number" value="0" min="0" max="${remainingWeekdays}" style="width:50px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
                回
              </label>
              <label style="font-size:0.9em;color:#6b7280;display:flex;align-items:center;gap:8px;">
                ・報告不足が 
                <input id="sim-missing" type="number" value="0" min="0" max="${remainingWeekdays}" style="width:50px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
                日
              </label>
              <label style="font-size:0.9em;color:#6b7280;display:flex;align-items:center;gap:8px;">
                ・追加で休みを 
                <input id="sim-vacation" type="number" value="0" min="0" max="${remainingVacation}" style="width:50px;padding:4px 8px;border:1px solid #d1d5db;border-radius:4px;text-align:center;">
                日
              </label>
            </div>
            <div style="font-size:0.9em;color:#6b7280;margin-top:10px;text-align:center;">発生した場合...</div>
          </div>

          <div id="sim-result" style="padding:20px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
            <div style="font-size:1.1em;color:#374151;margin-bottom:15px;text-align:center;">
              [予測される最終減点]
            </div>
            <div style="font-size:2em;font-weight:600;color:#16a34a;text-align:center;margin-bottom:20px;">
              ${finalDeduction.toFixed(1)} pts
            </div>
            
            <div style="font-size:1em;color:#374151;margin-bottom:10px;">
              [計算の内訳]
            </div>
            <div id="sim-calculation" style="font-size:0.9em;color:#6b7280;line-height:1.6;font-family:'Courier New',monospace;">
              <div>1. 現在の減点対象:        ${deductionPoints.toFixed(1)} pt</div>
              <div>2. 予測される追加減点:   + 0.0 pt (遅延 0件 + 不足 0日)</div>
              <div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>
              <div>3. 合計の減点対象:        ${deductionPoints.toFixed(1)} pt</div>
              <div>4. 残り休みでの相殺:     - ${remainingVacation} 日</div>
              <div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>
              <div>=> 予測減点: max(0, ${deductionPoints.toFixed(1)} - ${remainingVacation}) = ${finalDeduction.toFixed(1)} pt</div>
            </div>
          </div>
        </div>`;
    };

    // グローバル保存
    window.allReportData = allReportData;

    // 新しいダッシュボードレイアウト
    container.innerHTML = `
      <style>
        #analysis-result-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.4;
        }
        #analysis-result-container .dashboard-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
          margin-bottom: 15px;
          text-align: center;
        }
        #analysis-result-container .summary-section {
          border: 2px solid #d1d5db;
          border-radius: 6px;
          margin-bottom: 15px;
          overflow: hidden;
        }
        #analysis-result-container .summary-header {
          background: #f3f4f6;
          padding: 8px 15px;
          font-size: 1em;
          font-weight: 600;
          color: #374151;
          text-align: center;
        }
        #analysis-result-container .summary-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: #d1d5db;
        }
        #analysis-result-container .summary-item {
          background: #fff;
          padding: 15px;
        }
        #analysis-result-container .details-section {
          border: 2px solid #d1d5db;
          border-radius: 6px;
          margin-bottom: 15px;
          overflow: hidden;
        }
        #analysis-result-container .details-header {
          background: #f3f4f6;
          padding: 8px 15px;
          font-size: 1em;
          font-weight: 600;
          color: #374151;
          text-align: center;
        }
        #analysis-result-container .details-content {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1px;
          background: #d1d5db;
        }
        #analysis-result-container .details-item {
          background: #fff;
          padding: 15px;
          text-align: center;
        }
        #analysis-result-container .alert-section {
          border: 2px solid #fbbf24;
          border-radius: 6px;
          margin-bottom: 15px;
          background: #fffbeb;
          padding: 10px 15px;
        }
        #analysis-result-container .simulator-section {
          border: 2px solid #8b5cf6;
          border-radius: 6px;
          background: #faf5ff;
          padding: 10px 15px;
        }
        #analysis-result-container .date-link {
          color: #0066cc;
          text-decoration: none;
          margin-right: 6px;
        }
        #analysis-result-container .date-link:hover {
          text-decoration: underline;
        }
        #analysis-result-container .progress-text {
          font-family: 'Courier New', monospace;
          font-size: 0.85em;
          color: #3b82f6;
          margin: 6px 0;
        }
      </style>
      
      <div class="dashboard-header">
        <h2 style="margin:0;font-size:1.3em;color:#1f2937;">
          📊 進捗チェッカー
          <span style="font-size:0.6em;background:#f3f4f6;padding:3px 6px;border-radius:3px;color:#6b7280;margin-left:8px;">ID: ${code}</span>
        </h2>
      </div>

      <!-- 現時点のサマリー -->
      <div class="summary-section">
        <div class="summary-header">現時点のサマリー</div>
        <div class="summary-content">
          <div class="summary-item">
            <div style="font-size:1em;color:#374151;margin-bottom:8px;">📈 指定進捗報告日数pts</div>
            <div style="font-size:1.4em;font-weight:600;color:${effectivePoints >= RULES.REQUIRED_REPORTS ? '#16a34a' : '#dc2626'};margin-bottom:6px;">
              ${effectivePoints.toFixed(1)} / ${RULES.REQUIRED_REPORTS} pts
            </div>
            <div class="progress-text">[${createProgressBar(unitPercent)}] ${unitPercent}%</div>
            <div style="font-size:0.85em;color:#6b7280;margin-top:6px;">
              達成まで あと ${reportsNeeded.toFixed(1)} pts
            </div>
            <div style="font-size:0.85em;color:#6b7280;margin-top:6px;">
              単位取得十分条件のひとつです。
            </div>            
            
          </div>
          
          <div class="summary-item">
            <div style="font-size:1em;color:#374151;margin-bottom:8px;">📉 成績評価 (減点方式)</div>
            <div style="font-size:1.4em;font-weight:600;color:${finalDeduction === 0 ? '#16a34a' : '#dc2626'};margin-bottom:6px;">
              ${finalDeduction.toFixed(1)} pts
            </div>
            <div style="font-size:0.8em;color:#6b7280;line-height:1.3;">
              ${finalDeduction === 0 ? 
                `減点対象(${deductionPoints.toFixed(1)}pt)は、残り休み(${remainingVacation}日)ですべて相殺されるため、減点はありません。` :
                `減点対象(${deductionPoints.toFixed(1)}pt)のうち、${finalDeduction.toFixed(1)}ptが最終減点となります。`
              }
            </div>
            <div style="border-top:1px solid #e5e7eb;margin-top:6px;padding-top:6px;">
              <div style="font-size:0.75em;color:#6b7280;">減点対象の内訳:</div>
              <div style="font-size:0.75em;color:#6b7280;margin-top:3px;">
                ・期限後報告: ${(late * 0.5).toFixed(1)} pt (${late}件 × 0.5)<br>
                ・報告不足: ${missingCount.toFixed(1)} pt (${missingCount}件 × 1.0)<br>
                ・休み超過: ${Math.max(0, vacationCount - RULES.ALLOWED_DAYS_OFF)} 日
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 活動実績の詳細 -->
      <div class="details-section">
        <div class="details-header">活動実績の詳細</div>
        <div class="details-content">
          <div class="details-item">
            <div style="font-size:1em;color:#374151;margin-bottom:8px;">🏃 活動日数</div>
            <div style="font-size:1.6em;font-weight:600;color:#16a34a;margin-bottom:6px;">
              ${normal + late} 日
            </div>
            <div style="font-size:0.8em;color:#6b7280;">
              (内訳: 通常 ${normal}, 遅延 ${late})
            </div>
          </div>
          
          <div class="details-item">
            <div style="font-size:1em;color:#374151;margin-bottom:8px;">😴 休み</div>
            <div style="font-size:1.6em;font-weight:600;color:${vacationCount > RULES.ALLOWED_DAYS_OFF ? '#dc2626' : '#16a34a'};margin-bottom:6px;">
              ${vacationCount} 日 / ${RULES.ALLOWED_DAYS_OFF} 日 <span style="font-size:0.5em;">(上限)</span>
            </div>
            <div style="font-size:0.8em;color:#6b7280;">
              残り: ${remainingVacation} 日
            </div>
            ${createDetailsList(vacationDates, '休み', item => `<div style="padding:2px 0;"><a href="#" class="date-link" data-key="${item.key}">${item.date}</a></div>`)}
          </div>
          
          <div class="details-item">
            <div style="font-size:1em;color:#374151;margin-bottom:8px;">📅 期間進捗</div>
            <div style="font-size:1.6em;font-weight:600;color:#3b82f6;margin-bottom:6px;">
              ${weekdaysPassed} 日 / ${RULES.TOTAL_WEEKDAYS} 日
            </div>
            <div class="progress-text">[${createProgressBar(progressPercent)}] ${progressPercent}%</div>
            <div style="font-size:0.8em;color:#6b7280;margin-top:6px;">
              期間終了まで あと${remainingWeekdays}日
            </div>
          </div>
        </div>
      </div>

      <!-- 未提出の警告 -->
      ${missingCount > 0 ? `
      <div class="alert-section">
        <div style="font-size:1em;color:#dc2626;margin-bottom:6px;">
          📋 未提出の報告 (${missingCount}件)
        </div>
        <div style="font-size:0.85em;color:#92400e;">
          これらの日は平日にも関わらず報告が提出されていません。
        </div>
        ${createDetailsList(missingDates, '未提出', item => `<div style="padding:2px 0;"><a href="#" class="date-link" data-key="${item.key}">${item.date}</a></div>`)}
      </div>` : ''}

      <!-- 期限後報告の警告 -->
      ${late > 0 ? `
      <div class="alert-section">
        <div style="font-size:1em;color:#d97706;margin-bottom:6px;">
          ⚠️ 期限後報告 (${late}件)
        </div>
        <div style="font-size:0.85em;color:#92400e;">
          これらの報告は期限後に提出されたため、0.5点として計算されます。
        </div>
        ${createDetailsList(lateDates, '期限後', item => `<div style="padding:2px 0;"><a href="#" class="date-link" data-key="${item.key}">${item.date}</a> <span style="color:#6b7280;font-size:0.8em;">(${item.time})</span></div>`)}
      </div>` : ''}

      <!-- 成績シミュレーター -->
      <div class="simulator-section">
        ${createSimulator(deductionPoints, remainingVacation, remainingWeekdays)}
      </div>
    `;

    // シミュレーション機能
    function updateSimulation() {
      const simLate = parseInt(document.getElementById('sim-late').value, 10) || 0;
      const simMissing = parseInt(document.getElementById('sim-missing').value, 10) || 0;
      const simVacation = parseInt(document.getElementById('sim-vacation').value, 10) || 0;
      
      // 3つの項目の合計が残り平日を超えないよう制約
      const totalSimulated = simLate + simMissing + simVacation;
      if (totalSimulated > remainingWeekdays) {
        // 超過した場合、最後に入力された項目を調整
        const lastChangedInput = document.activeElement;
        if (lastChangedInput && lastChangedInput.type === 'number') {
          const excess = totalSimulated - remainingWeekdays;
          const currentValue = parseInt(lastChangedInput.value, 10) || 0;
          const newValue = Math.max(0, currentValue - excess);
          lastChangedInput.value = newValue;
          
          // 値を再取得
          const newLate = parseInt(document.getElementById('sim-late').value, 10) || 0;
          const newMissing = parseInt(document.getElementById('sim-missing').value, 10) || 0;
          const newVacation = parseInt(document.getElementById('sim-vacation').value, 10) || 0;
          
          updateSimulationWithValues(newLate, newMissing, newVacation);
        }
      } else {
        updateSimulationWithValues(simLate, simMissing, simVacation);
      }
    }

    function updateSimulationWithValues(simLate, simMissing, simVacation) {
      const additionalDeduction = (simLate * 0.5) + simMissing;
      const totalDeductionPoints = deductionPoints + additionalDeduction;
      const futureVacation = remainingVacation - simVacation;
      const futureDeduction = Math.max(0, totalDeductionPoints - futureVacation) + Math.max(0, -futureVacation);
      const futureScore = Math.max(0, RULES.REQUIRED_REPORTS - futureDeduction);
      const futureScorePercent = ((futureScore / RULES.REQUIRED_REPORTS) * 100).toFixed(1);
      
      // 結果の色分け
      const getResultColor = (deduction) => {
        if (deduction === 0) return '#16a34a';
        if (deduction <= 5) return '#d97706';
        return '#dc2626';
      };
      
      // 合計表示の追加
      const totalUsed = simLate + simMissing + simVacation;
      const remainingDays = remainingWeekdays - totalUsed;
      
      document.getElementById('sim-result').innerHTML = `
        <div style="font-size:1.1em;color:#374151;margin-bottom:15px;text-align:center;">
          [予測される最終減点]
        </div>
        <div style="font-size:2em;font-weight:600;color:${getResultColor(futureDeduction)};text-align:center;margin-bottom:20px;">
          ${futureDeduction.toFixed(1)} pts
        </div>
        
        <div style="font-size:1em;color:#374151;margin-bottom:10px;">
          [計算の内訳]
        </div>
        <div style="font-size:0.9em;color:#6b7280;line-height:1.6;font-family:'Courier New',monospace;">
          <div>1. 現在の減点対象:        ${deductionPoints.toFixed(1)} pt</div>
          <div>2. 予測される追加減点:   + ${additionalDeduction.toFixed(1)} pt (遅延 ${simLate}件 + 不足 ${simMissing}日)</div>
          <div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>
          <div>3. 合計の減点対象:        ${totalDeductionPoints.toFixed(1)} pt</div>
          <div>4. 残り休みでの相殺:     - ${futureVacation} 日</div>
          <div style="border-top:1px solid #e5e7eb;margin:8px 0;"></div>
          <div>=> 予測減点: max(0, ${totalDeductionPoints.toFixed(1)} - ${futureVacation}) = ${futureDeduction.toFixed(1)} pt</div>
        </div>
        
        <div style="margin-top:15px;padding:8px;background:#f8f9fa;border-radius:4px;border:1px solid #e5e7eb;">
          <div style="font-size:0.85em;color:#6b7280;text-align:center;">
            合計日数: ${totalUsed} / ${remainingWeekdays} 日 (残り ${remainingDays} 日)
          </div>
        </div>
        
        <div style="margin-top:15px;padding:12px;background:${futureDeduction > 0 ? '#fef3c7' : '#dcfce7'};border-radius:6px;border:1px solid ${futureDeduction > 0 ? '#fbbf24' : '#16a34a'};">
          <div style="font-size:0.9em;color:${futureDeduction > 0 ? '#92400e' : '#166534'};">
            ${futureDeduction > 0 ? '⚠️' : '✅'} 最終成績: ${futureScorePercent}% (${futureScore.toFixed(1)} / ${RULES.REQUIRED_REPORTS} 点)
          </div>
        </div>
      `;
    }

    // イベントリスナー
    document.querySelectorAll('#analysis-result-container input[type="number"]').forEach(input => {
      input.addEventListener('input', updateSimulation);
      input.addEventListener('blur', updateSimulation);
    });

    // 初期表示のためにシミュレーション関数を実行
    updateSimulation();

    // 日付クリック機能
    const topElement = document.querySelector('body > div');
    document.querySelectorAll('.date-link').forEach(link => {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const key = this.dataset.key;
        const reportData = window.allReportData[key];
        if (reportData && typeof reportViewModel === 'function') {
          const viewModel = new reportViewModel(reportData);
          main.current(viewModel);
          if (topElement) {
            topElement.scrollIntoView({behavior: 'smooth'});
          }
        }
      });
    });

    console.log("進捗チェッカー: 分析完了");

  } catch (e) {
    console.error("進捗チェッカーでエラー:", e);
    alert(`エラーが発生しました: ${e.message}\n詳細はコンソールを確認してください。`);
  }
})();