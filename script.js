document.addEventListener("DOMContentLoaded", () => {
 // Google Apps Script URL (새 배포 버전을 확인하여 여기에 입력하세요!)
 const API_URL = 'https://script.google.com/macros/s/AKfycbzd7atjDCME61bCi_7TuToK6CNZxckI7bqReZt6p7b_oq6TRW_TiwbQGlLWnlsXihRJDA/exec';

 const form = document.getElementById("petSurveyForm");
 const msg = document.getElementById("msg");
 const submissionsList = document.getElementById("submissionsList");
 const regionOtherInput = document.querySelector('input[name="regionOther"]');
 const tabBtns = document.querySelectorAll(".tab-btn");

 let localSubmissions = []; // 서버에서 불러온 전체 데이터

 // ⭐️ 1. 핵심 수정: Sheets의 열 이름과 폼의 name 속성을 일치하도록 재정의 (렌더링을 위해) ⭐️
 // GAS 스크립트가 폼의 name 속성(priorityCriteria, concernAndFeature, priceRange)을 Sheets의 열 이름으로 사용한다고 가정하고 매핑합니다.
 const keyMap = {
  hasPet: "반려동물 보유",
  region: "지역",
  regionOther: "직접 입력 지역",
  priorityCriteria: "병원 선택 기준",  // Q3
  concernAndFeature: "우려/필요 기능", // Q4
  priority1: "1순위 정보",
  priority2: "2순위 정보",
  priceRange: "지불 의향 금액",      // Q6
 };

 // ⭐️ 2. 표시할 핵심 항목을 폼의 name 속성 (Sheets 열 이름)으로 정의 ⭐️
 // Q3, Q4, Q6 항목을 모두 보여주도록 수정했습니다.
 const displayKeys = ["priorityCriteria", "concernAndFeature", "priceRange"];


 /**
 * 1. 서버에서 최신 데이터를 가져와 localSubmissions를 갱신하고, 화면을 다시 그리는 핵심 함수
 */
 const fetchSubmissions = async () => {
  try {
   const uniqueApiUrl = `${API_URL}?t=${new Date().getTime()}`;
   submissionsList.innerHTML = '<div class="placeholder">제출된 기록을 불러오는 중입니다...</div>';

   const res = await fetch(uniqueApiUrl);
   if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  
   const data = await res.json();
  
   if (Array.isArray(data)) {
    localSubmissions = data;
    renderSubmissions(); // 목록 갱신
   } else {
    submissionsList.innerHTML = '<div class="placeholder">데이터 로딩 실패: 서버 응답 형식이 올바르지 않습니다.</div>';
   }
  } catch (error) {
   console.error("서버 데이터 로딩 오류:", error);
   submissionsList.innerHTML = '<div class="placeholder">네트워크 오류 또는 서버 오류로 데이터를 불러올 수 없습니다.</div>';
  }
 };


 // 2. 폼 제출 (POST) 로직 - 중복 제출 방지 및 서버 응답 확인 로직 추가
 form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.querySelector('.btn.primary');
  msg.textContent = "✅ 제출 중...";
  submitBtn.disabled = true; // 버튼 비활성화로 중복 클릭 방지

  const data = new FormData(form);
  const payload = {};
  for (const [k, v] of data.entries()) payload[k] = v;

  try {
   const res = await fetch(API_URL, {
    method: 'POST',
    // ❌ mode: 'no-cors' 제거
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
   });

   // 1. HTTP 응답 상태 코드 확인
   if (!res.ok) {
    throw new Error(`서버 연결 오류 (상태: ${res.status})`);
   }

   // 2. 서버 JSON 응답 확인 (GAS에서 {status: 'success'}를 리턴해야 함)
   const result = await res.json(); 

   if (result.status === 'success') { 
    msg.textContent = "💌 제출이 성공적으로 완료되었습니다! 의견 목록을 갱신합니다.";

    await fetchSubmissions(); // 성공 시 데이터 갱신
    form.reset();
    regionOtherInput.style.display = "none";
    // '다른 사람 의견 보기' 탭으로 자동 전환 및 활성화
    document.querySelector('.tab-btn[data-target="submissions"]').click();
   } else {
    // GAS에서 에러를 보냈을 경우
    throw new Error(`서버 처리 실패: ${result.message || '데이터 저장 실패'}`);
   }

  } catch (error) {
   // 제출 실패 시
   msg.textContent = `⚠️ 제출 실패 오류: ${error.message}. 다시 시도해주세요.`;
   console.error("제출 오류:", error);
   // 실패 시에는 fetchSubmissions()를 호출하지 않아 중복 저장을 방지함.
  } finally {
   submitBtn.disabled = false; // 버튼 재활성화
  }
 });

 // 3. submissions 렌더링
 const renderSubmissions = () => {
  submissionsList.innerHTML = "";
 
  if (localSubmissions.length === 0) {
    submissionsList.innerHTML = '<div class="placeholder">아직 제출된 기록이 없습니다.</div>';
    return;
  }
 
  // 중복 렌더링 방지 및 최신 10개만 표시 (slice().reverse().slice(0, 10))
  localSubmissions.slice().reverse().slice(0, 10).forEach((sub, index) => {
   const card = document.createElement("div");
   card.className = "record fade-in";
   card.style.setProperty('--delay', `${index * 0.05}s`);

   // ⭐️ displayKeys (폼의 name 속성)만 순회하며 렌더링
   let html = displayKeys
     .map(k => {
       // keyMap에서 폼 name(k)에 맞는 레이블을 가져옵니다.
       const label = keyMap[k];
       let value = sub[k]; // Sheets에서 읽어온 값
      
       // 최종 값이 없거나 빈 문자열이면 "응답 없음"을 표시
       const displayValue = (value && value !== "" && value !== " ") ? value : "응답 없음";
      
       // 스타일링 코드 유지
       return `<div class="record-item">
         <strong>${label}:</strong>
         <span class="${displayValue === '응답 없음' ? 'text-muted' : 'text-accent'}">${displayValue}</span>
        </div>`;
     })
    .join("");
   
   if (!html) html = "<div>제출된 정보 없음</div>";
   card.innerHTML = html;
   submissionsList.appendChild(card);
  });
 };

 // 4. 탭 클릭 이벤트 (기존 유지)
 tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
   tabBtns.forEach(b => b.classList.remove("active"));
   document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  
   btn.classList.add("active");
   document.getElementById(btn.dataset.target).classList.add("active");

   // submissions 탭이 활성화될 때만 fetchSubmissions 호출
   if (btn.dataset.target === "submissions") {
    fetchSubmissions();
   }
  });
 });

 // 5. "기타" 입력 토글 (기존 유지)
 document.querySelectorAll('input[name="region"]').forEach(radio => {
  radio.addEventListener('change', () => {
   if (radio.value === "기타") {
    regionOtherInput.style.display = "block";
    regionOtherInput.required = true;
   } else {
    regionOtherInput.style.display = "none";
    regionOtherInput.required = false;
   }
  });
 });

});
