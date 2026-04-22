let winLossChart;
let editId = null;
let currentLogs = [];

window.onload = function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tradeDate').value = today;

    loadLogs();
    setupInputListeners(); // ★ 자동 부호 보정 활성화
};
// 월별 체크박스 토글
window.toggleGroup = function(master, groupId) {
    const checkboxes = document.querySelectorAll(`.${groupId}`);
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
};

// 연도별 체크박스 토글
window.toggleYearGroup = function(master, yearId) {
    const children = document.querySelectorAll(`.${yearId}_child`);
    children.forEach(cb => {
        cb.checked = master.checked;
    });
};

// 1. [복구] 결과 선택에 따른 수익금 부호(+) / (-) 자동 변환 로직
function setupInputListeners() {
    const resultRadios = document.querySelectorAll('input[name="result"]');
    const profitInput = document.getElementById('profit');

    resultRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            let val = parseFloat(profitInput.value);
            if (!isNaN(val)) {
                // 패(LOSS) 선택 시 양수면 마이너스로, 승(WIN) 선택 시 음수면 플러스로
                if (this.value === 'LOSS' && val > 0) profitInput.value = -val;
                else if (this.value === 'WIN' && val < 0) profitInput.value = Math.abs(val);
            }
        });
    });

    // 직접 수익금 입력 시에도 체크된 라디오 버튼에 따라 부호 강제 적용
    profitInput.addEventListener('input', function() {
        const selectedResult = document.querySelector('input[name="result"]:checked')?.value;
        let val = parseFloat(this.value);
        if (!isNaN(val)) {
            if (selectedResult === 'LOSS' && val > 0) this.value = -val;
            else if (selectedResult === 'WIN' && val < 0) this.value = Math.abs(val);
        }
    });
}

// 2. 데이터 로드
async function loadLogs() {
    try {
        const response = await fetch('/api/journal');
        const data = await response.json();
        currentLogs = data;
        displayLogs(data); 
        updateChart(data); 
    } catch (error) {
        console.error("데이터 로드 실패:", error);
    }
}

// 3. [복구] 도넛 차트 & 우측 승률 (12시 기준: 좌측 초록 / 우측 빨강)
function updateChart(logs) {
    const ctx = document.getElementById('winLossChart');
    if (!ctx) return;

    const stats = logs.reduce((acc, log) => {
        const profit = log.profit || 0;
        acc.totalProfit += profit;
        
        if (log.result === 'WIN') {
            acc.winCount++;
            acc.winSum += Math.abs(profit);
        } else if (log.result === 'LOSS') {
            acc.lossSum += Math.abs(profit);
        } else {
            acc.drawCount++;
        }
        acc.totalCount++;
        return acc;
    }, { winSum: 0, lossSum: 0, drawCount: 0, winCount: 0, totalCount: 0, totalProfit: 0 });

    // 우측 승률 텍스트 업데이트
    const winRate = stats.totalCount > 0 ? ((stats.winCount / stats.totalCount) * 100).toFixed(1) : 0;
    const winRateDisplay = document.getElementById('winRateValue');
    if (winRateDisplay) winRateDisplay.innerText = `${winRate}%`;

    const sign = stats.totalProfit > 0 ? '+' : '';
    const profitColor = stats.totalProfit > 0 ? '#00ff88' : (stats.totalProfit < 0 ? '#ff4444' : '#e0e0e0');

    if (winLossChart) winLossChart.destroy();

    // 12시 방향에서 시작하여 시계 방향으로 [패, 무, 승] 배치
    // -> 12시 기준 오른쪽은 패(빨강), 왼쪽은 승(초록)이 됨

    const hasData = stats.totalCount > 0;

    winLossChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: hasData ? ['Win', 'Draw', 'Loss'] : ['데이터 없음'],
            datasets: [{
                data: hasData ? [stats.lossSum || 0.0001, stats.drawCount || 0.0001, stats.winSum || 0.0001] : [1],
                backgroundColor: hasData ? ['#ff4444', '#888888', '#00ff88'] : ['#ffffff'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            rotation: 0, // 시작 지점을 12시로 고정
            plugins: { legend: { display: false },
                       tooltip: { enabled: hasData }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: (chart) => {
                const { width, height, ctx } = chart;
                ctx.restore();
                ctx.font = "bold 1.4rem 'Pretendard', sans-serif";
                ctx.fillStyle = profitColor;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(`${sign}${stats.totalProfit.toFixed(2)}$`, width / 2, height / 2);
                ctx.save();
            }
        }]
    });
}

// 4. 저장 기능 (수정 완료 후 즉시 리스트 갱신)
async function saveLog() {
    const resultValue = document.querySelector('input[name="result"]:checked')?.value;
    if (!document.getElementById('tradeDate').value || !resultValue) {
        return alert("날짜와 결과를 선택해주세요!");
    }

    const logData = {
        tradeDate: document.getElementById('tradeDate').value,
        symbol: document.getElementById('symbol').value,
        position: document.getElementById('position').value,
        result: resultValue,
        profit: parseFloat(document.getElementById('profit').value) || 0,
        imageUrl: document.getElementById('imageUrl').value,
        psychology: document.getElementById('psychology').value,
        memo: document.getElementById('memo').value
    };

    try {
        const response = await fetch('/api/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        });

        if (response.ok) {
            if (editId !== null) {
                await fetch(`/api/journal/${editId}`, { method: 'DELETE' });
                editId = null;
            }
            alert("저장 성공!");
            await loadLogs(); // 리스트 및 차트 즉시 로드
            clearForm();
        }
    } catch (e) { alert("저장 실패"); }
}

// 5. 리스트 출력 및 기타 기능
function displayLogs(logs) {
    const logContainer = document.getElementById('logTableBody');
    if (!logContainer) return;
    logContainer.innerHTML = '';

    const nestedData = logs.reduce((acc, log) => {
        const date = new Date(log.tradeDate);
        const year = `${date.getFullYear()}년`;
        const month = `${date.getMonth() + 1}월`;
        if (!acc[year]) acc[year] = {};
        if (!acc[year][month]) acc[year][month] = [];
        acc[year][month].push(log);
        return acc;
    }, {});

    const sortedYears = Object.keys(nestedData).sort();

    sortedYears.forEach((year, yIdx) => {
        const yearSection = document.createElement('div');
        const yearId = `year_${yIdx}`;
        // 마지막 연도는 기본적으로 열려있게(active)
        const isLastYear = yIdx === sortedYears.length - 1;
        yearSection.className = `year-section ${isLastYear ? 'active' : ''}`;
        
        // [2번 수정] 화살표 및 클릭 이벤트 복구
        yearSection.innerHTML = `
            <div class="group-header year-header" onclick="this.closest('.year-section').classList.toggle('active')">
                <input type ="checkbox"
                    class="year-master-check"
                    onchange="toggleYearGroup(this, '${yearId}')"
                    onclick="event.stopPropagation();">
                <span class="arrow">▶</span> 📅 ${year}
            </div>
            <div class="year-content"></div>
        `;
        
        const yearContent = yearSection.querySelector('.year-content');
        const sortedMonths = Object.keys(nestedData[year]).sort((a, b) => parseInt(a) - parseInt(b));

        sortedMonths.forEach((month, mIdx) => {
            const monthSection = document.createElement('div');
            const isLastMonth = isLastYear && mIdx === sortedMonths.length - 1;
            monthSection.className = `month-section ${isLastMonth ? 'active' : ''}`;
            const groupId = `group_${yIdx}_${mIdx}`;
            
            // [3번 수정] 테이블 내 체크박스 복구
            monthSection.innerHTML = `
                <div class="group-header month-header" onclick="this.closest('.month-section').classList.toggle('active')">
                    <span class="arrow">▶</span> 📁 ${month} (${nestedData[year][month].length}건)
                </div>
                <div class="month-content table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th><input type="checkbox" onchange="toggleGroup(this, '${groupId}')"></th>
                                <th>날짜</th><th>종목</th><th>결과</th><th>수익금</th><th>관리</th>
                            </tr>
                        </thead>
                        <tbody class="list_${groupId}"></tbody>
                    </table>
                </div>
            `;

            const tbody = monthSection.querySelector(`.list_${groupId}`);
            nestedData[year][month].sort((a,b) => new Date(a.tradeDate) - new Date(b.tradeDate)).forEach((log) => {
                const profit = log.profit || 0;
                tbody.innerHTML += `
                    <tr>
                        <td class="checkbox-cell">
                            <label class="checkbox-wrapper">
                                <input type="checkbox"
                                    class="log-checkbox ${groupId} ${yearId}_child"
                                    value="${log.id}"
                                    onclick ="event.stopPropagation();">
                            </label>
                        </td>
                        <td>${log.tradeDate}</td>
                        <td>${log.symbol}</td>
                        <td><span class="result-tag ${log.result.toLowerCase()}">${log.result}</span></td>
                        <td style="color: ${profit > 0 ? '#00ff88' : (profit < 0 ? '#ff4444' : '#888888')}">
                            ${profit > 0 ? '+' : ''}${profit.toFixed(2)}$
                        </td>
                        <td>
                            <div class="action-btns">
                                <button onclick="handleDetailClick(${log.id})" class="btn-detail" style="background:#333; color:#76c8f3; border:1px solid #444; padding:3px 3px; font-size:0.75rem; border-radius:4px; cursor:pointer;">상세</button>
                                <button onclick='editLog(${JSON.stringify(log)})' class="btn-edit">✏️</button>
                                <button onclick='deleteLog(${log.id})' class="btn-delete">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            yearContent.appendChild(monthSection);
        });
        logContainer.appendChild(yearSection);
    });
}

// [복구] 체크박스 전체 선택 기능
function toggleGroup(master, groupId) {
    // 해당 그룹 아이디를 클래스로 가진 모든 체크박스 선택
    const checkboxes = document.querySelectorAll('.' + groupId);
    checkboxes.forEach(cb => {
        cb.checked = master.checked;
    });
}

// 연도별 전체 선택
function toggleYearGroup(master, yearId) {
    // 해당 연도 아이디를 클래스로 가진 모든 하위 체크박스 선택
    const children = document.querySelectorAll(`.${yearId}_child`);
    children.forEach(cb => {
        cb.checked = master.checked;
    });
}

// [복구] 선택 항목 삭제 기능
async function deleteSelected() {
    const checkedBoxes = document.querySelectorAll('.log-checkbox:checked');
    if (checkedBoxes.length === 0) return alert("삭제할 항목을 선택해주세요.");
    if (!confirm(`선택한 ${checkedBoxes.length}개를 삭제하시겠습니까?`)) return;

    try {
        await Promise.all(Array.from(checkedBoxes).map(cb => fetch(`/api/journal/${cb.value}`, { method: 'DELETE' })));
        await loadLogs();
    } catch (e) { alert("삭제 실패"); }
}

function clearForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tradeDate').value = today;

    document.getElementById('profit').value = "";
    document.getElementById('psychology').value = "";
    document.getElementById('memo').value = "";
    document.getElementById('imageUrl').value = "";

    const saveBtn = document.querySelector('button[onclick="saveLog()"]');
    saveBtn.innerText = "일지 저장"; saveBtn.style.backgroundColor = "";
}

function openDetail(log) {
    const detailWindow = window.open('', '_blank');
    detailWindow.document.write(`
        <html><head><title>매매복기 - ${log.symbol}</title><style>
            body{background:#1a1a1a;color:#eee;padding:30px;font-family:sans-serif;line-height:1.6;}
            .content{background:#252525;padding:15px;border-radius:8px;white-space:pre-wrap;border:1px solid #333;margin-bottom:20px;}
            h1{color:#76c8f3;} h3{color:#00ff88; border-left:4px solid #00ff88; padding-left:10px;}
            a{color:#76c8f3; text-decoration:none;} a:hover{text-decoration:underline;}
        </style></head><body>
            <h1>📊 매매 복기: ${log.symbol} (${log.tradeDate})</h1>
            <p><strong>포지션:</strong> ${log.position} | <strong>결과:</strong> ${log.result} | <strong>수익:</strong> ${log.profit}$</p>
            <p><strong>🔗Link:</strong> <a href="${log.imageUrl}" target="_blank">${log.imageUrl || '없음'}</a></p>
            <hr style="border:0; border-top:1px solid #333; margin:20px 0;">
            <h3>✅ 매매 근거</h3>
            <div class="content">${log.psychology || '작성된 내용이 없습니다.'}</div>
            <h3>📝 비고</h3>
            <div class="content">${log.memo || '작성된 내용이 없습니다.'}</div>
        </body></html>
    `);
}

async function deleteLog(id) {
    if (confirm("삭제할까요?")) {
        const res = await fetch(`/api/journal/${id}`, { method: 'DELETE' });
        if (res.ok) await loadLogs();
    }
}

function editLog(log) {
    editId = log.id;
    document.getElementById('tradeDate').value = log.tradeDate;
    document.getElementById('symbol').value = log.symbol;
    document.getElementById('profit').value = log.profit;
    const radio = document.querySelector(`input[name="result"][value="${log.result}"]`);
    if (radio) radio.checked = true;
    const saveBtn = document.querySelector('button[onclick="saveLog()"]');
    saveBtn.innerText = "수정 완료"; saveBtn.style.backgroundColor = "#4488ff";
}

// 상세 버튼 클릭 시 호출될 징검다리 함수
function handleDetailClick(id) {
    // 민수님 코드에 선언된 배열 이름(currentlogs)을 확인하세요. 
    // 대소문자 주의: currentlogs인지 currentLogs인지 확인 후 맞추면 됩니다.
    const targetLog = currentLogs.find(l => l.id === id);
    if (targetLog) {
        openDetail(targetLog); // 기존에 있던 함수 호출
    } else {
        console.error("해당 로그를 찾을 수 없습니다.");
    }
}

function calculateTrade() {
    // [확인] HTML의 id가 riskAmount이므로 그대로 사용합니다.
    const seedUSD = parseFloat(document.getElementById('balance').value) || 0;
    const riskPercent = parseFloat(document.getElementById('riskAmount').value) || 0; 
    const entryPriceUSD = parseFloat(document.getElementById('entryPrice').value) || 0;
    const stopLossUSD = parseFloat(document.getElementById('stopLoss').value) || 0;

    // 환율 변수가 없을 경우를 대비해 1350원(기본값) 설정
    const exchangeRate = typeof currentExchangeRate !== 'undefined' ? currentExchangeRate : 1350;

    const priceDiffUSD = Math.abs(entryPriceUSD - stopLossUSD);

    if (seedUSD > 0 && riskPercent > 0 && priceDiffUSD > 0) {
        const targetRiskUSD = seedUSD * (riskPercent / 100);
        let quantity = targetRiskUSD / priceDiffUSD;

        if (quantity < 0.001) {
            quantity = 0.001;
        } else {
            quantity = Math.floor(quantity * 1000) / 1000;
        }

        const usableSeed = seedUSD * 0.25; 
        let requiredLev = (quantity * entryPriceUSD) / usableSeed;

        document.getElementById('resQty').innerText = quantity;
        document.getElementById('resLev').innerText = requiredLev.toFixed(2) + "x";

        // 검증 로그 (환율 에러 방지 처리됨)
        console.log(`[검증] 손절 시 약 ${Math.round(targetRiskUSD * exchangeRate)}원 손실`);
    } else {
        document.getElementById('resQty').innerText = "0";
        document.getElementById('resLev').innerText = "0";
    }
}