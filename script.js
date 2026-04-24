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
        // 1. 서버대신 로컬 스토리지에서 데이터를 읽어옵니다.
        const data = JSON.parse(localStorage.getItem('tradingLogs')) || [];
        
        // 2. 읽어온 데이터를 전역 변수(currentLogs)에 담아줍니다.
        currentLogs = data;
        
        // 3. 기존에 사용하던 화면 출력 및 차트 업데이트 함수 실행
        displayLogs(data); 
        updateChart(data); 
        
        console.log("로컬 데이터 로드 완료:", data);
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
async function saveLog(event) {
    if(event) event.preventDefault();
    const resultValue = document.querySelector('input[name="result"]:checked')?.value;
    if (!document.getElementById('tradeDate').value || !resultValue) {
        return alert("날짜와 결과를 선택해주세요!");
    }

    const logData = {
        id: editId || Date.now(), // 수정 중이면 기존 ID, 새 글이면 현재 시간으로 고유 ID 생성
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
        // --- [로컬 스토리지 저장 로직 시작] ---
        // 1. 기존 데이터 가져오기 (없으면 빈 배열)
        let logs = JSON.parse(localStorage.getItem('tradingLogs')) || [];

        if (editId !== null) {
            // 2. 수정 모드일 때: 기존 데이터 찾아서 교체
            const index = logs.findIndex(log => log.id === editId);
            if (index !== -1) {
                logs[index] = logData;
            }
            editId = null; // 수정 완료 후 초기화
        } else {
            // 3. 새 글 작성일 때: 배열에 추가
            logs.push(logData);
        }

        // 4. 로컬 스토리지에 최종 배열 저장
        localStorage.setItem('tradingLogs', JSON.stringify(logs));
        // --- [로컬 스토리지 저장 로직 끝] ---

        alert("브라우저에 저장 성공!");
        
        // 5. 화면 갱신
        if (typeof loadLogs === 'function') {
            await loadLogs(); 
        }
        clearForm();

    } catch (e) { 
        console.error(e);
        alert("저장 실패" + e.message); 
    }
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
        // 선택된 모든 ID값들을 배열로 가져오기
        const selectedIds = Array.from(checkedBoxes).map(cb => Number(cb.value));
        
        // 로컬 스토리지 데이터 가져오기
        let logs = JSON.parse(localStorage.getItem('tradingLogs')) || [];
        
        // 선택된 ID들에 포함되지 않은 로그들만 남기기
        logs = logs.filter(log => !selectedIds.includes(log.id));
        
        // 다시 로컬 스토리지에 저장
        localStorage.setItem('tradingLogs', JSON.stringify(logs));
        
        // 화면 갱신
        await loadLogs();
    } catch (e) { 
        console.error(e);
        alert("삭제 실패"); 
    }
}

function clearForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tradeDate').value = today;

    document.getElementById('profit').value = "";
    document.getElementById('psychology').value = "";
    document.getElementById('memo').value = "";
    document.getElementById('imageUrl').value = "";

    const saveBtn = document.getElementById('saveBtn'); 
    if (saveBtn) {
        saveBtn.innerText = "일지 저장"; 
        saveBtn.style.backgroundColor = "";
    }
    
    editId = null;
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
        // 로컬 스토리지에서 전체 데이터 가져오기
        let logs = JSON.parse(localStorage.getItem('tradingLogs')) || [];
        
        // 해당 id를 제외한 나머지 데이터만 필터링 (삭제 효과)
        logs = logs.filter(log => log.id !== id);
        
        // 다시 로컬 스토리지에 저장
        localStorage.setItem('tradingLogs', JSON.stringify(logs));
        
        // 화면 갱신
        await loadLogs();
    }
}

function editLog(log) {
    // 1. 수정할 데이터의 ID 저장
    editId = log.id;

    // 2. 기본 정보 복구
    document.getElementById('tradeDate').value = log.tradeDate;
    document.getElementById('symbol').value = log.symbol;
    document.getElementById('profit').value = log.profit;

    // 3. 승/패/무 라디오 버튼 복구
    const radio = document.querySelector(`input[name="result"][value="${log.result}"]`);
    if (radio) radio.checked = true;

    // 🔴 4. [추가된 부분] 상세 정보(복기, 근거, 비고) 복구
    // 이 세 줄이 빠져 있어서 상세 내용이 안 나왔던 겁니다!
    document.getElementById('imageUrl').value = log.imageUrl || ""; 
    document.getElementById('psychology').value = log.psychology || ""; 
    document.getElementById('memo').value = log.memo || ""; 

    // 5. 버튼 상태 변경
    // id="saveBtn"을 쓰거나, 현재 버튼의 텍스트를 바꿉니다.
    const saveBtn = document.getElementById('saveBtn') || document.querySelector('button[onclick*="saveLog"]');
    if (saveBtn) {
        saveBtn.innerText = "수정 완료";
        saveBtn.style.backgroundColor = "#4488ff";
    }

    // 6. 화면을 위로 올려서 수정 중임을 인지하게 함
    const inputSection = document.getElementById('input-section'); 
    if (inputSection) {
        inputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    const seedUSD = parseFloat(document.getElementById('balance').value) || 0;
    const riskPercent = parseFloat(document.getElementById('riskAmount').value) || 0; 
    const entryPriceUSD = parseFloat(document.getElementById('entryPrice').value) || 0;
    const stopLossUSD = parseFloat(document.getElementById('stopLoss').value) || 0;

    const exchangeRate = typeof currentExchangeRate !== 'undefined' ? currentExchangeRate : 1350;

    const priceDiffUSD = Math.abs(entryPriceUSD - stopLossUSD);

    if (seedUSD > 0 && riskPercent > 0 && priceDiffUSD > 0) {
        const targetRiskUSD = seedUSD * (riskPercent / 100);
        
        // [수정] Math.round를 사용하여 소수점 셋째 자리에서 반올림합니다.
        // 0.0484 -> 0.048 (버림 효과)
        // 0.0486 -> 0.049 (올림 효과)
        let quantity = Math.round((targetRiskUSD / priceDiffUSD) * 1000) / 1000;

        if (quantity < 0.001) {
            quantity = 0.001;
        }

        // [수정] 레버리지는 시드 전체(100%)를 증거금으로 사용할 때를 기준으로 계산합니다.
        // 그래야 365달러 기준 0.049개 진입 시 10.46x가 나옵니다.
        let requiredLev = (quantity * entryPriceUSD) / seedUSD;

        document.getElementById('resQty').innerText = quantity;
        document.getElementById('resLev').innerText = requiredLev.toFixed(2) + "x";

        console.log(`[검증] 수량: ${quantity}, 필요 레버리지: ${requiredLev.toFixed(2)}x`);
        console.log(`[검증] 예상 손실: $${(quantity * priceDiffUSD).toFixed(2)} (${Math.round(quantity * priceDiffUSD * exchangeRate)}원)`);
    } else {
        document.getElementById('resQty').innerText = "0";
        document.getElementById('resLev').innerText = "0";
    }
}