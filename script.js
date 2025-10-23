// === 수정된 JavaScript 코드 (중복 제출 방지 버전) ===
document.addEventListener("DOMContentLoaded", () => {
  // Google Apps Script URL (고객님께서 요청하신 링크로 최종 업데이트)
  const API_URL = 'https://script.google.com/macros/s/AKfycbwfqm6JLNMXqL1MTumvEMuCp_IeBnddDMmIKocbQaMqOzXXayFz9DzdUWHnyt4LZEZ6AA/exec';
  
  const form = document.getElementById("petSurveyForm");
  const msg = document.getElementById("msg");
  const submissionsList = document.getElementById("submissionsList");
  const regionOtherInput = document.querySelector('input[name="regionOther"]');
  const tabBtns = document.querySelectorAll(".tab-btn");

  let localSubmissions = []; // 서버에서 불러온 전체 데이터
  let isSubmitting = false; // 💡 제출 잠금 플래그 추가

  // ⭐️ 1. 핵심: GAS에서 반환하는 실제 키 (priorityCriteria, concernAndFeature, priceRange)와 일치하도록 정의 ⭐️
  const keyMap = {
    hasPet: "반려동물 보유",
    region: "지역",
    regionOther: "직접 입력 지역",
    priorityCriteria: "병원 선택 기준 (Q3)",
    concernAndFeature: "우려/필요 기능 (Q4)",
    priceRange: "지불 의향 금액 (Q6)",
    priority1: "1순위 정보",
    priority2: "2순위 정보",
  };

  // ⭐️ 2. 표시할 핵심 항목을 올바른 키로 정의 ⭐️
  const displayKeys = ["priorityCriteria", "priceRange", "concernAndFeature"];

  /**
   * 서버에서 최신 데이터를 가져와 localSubmissions를 갱신하고, 화면을 다시 그리는 함수
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

  // 2. 폼 제출 (POST 후, 전체 데이터 재요청 로직 포함) - 중복 제출 방지 수정
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]'); // 버튼 찾기

    if (isSubmitting) { // 💡 중복 제출 방지 체크
      msg.textContent = "⚠️ 이미 제출 중입니다. 잠시만 기다려 주세요.";
      return;
    }

    // 💡 제출 시작 시 잠금 및 버튼 비활성화
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = "제출 중...";
    msg.textContent = "✅ 제출 중...";

    const data = new FormData(form);
    const payload = {};
    for (const [k, v] of data.entries()) payload[k] = v;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        if (result.status === 'success') {
          msg.textContent = "💌 제출이 완료되었습니다! 의견 목록을 갱신합니다.";
          
          await fetchSubmissions();
          form.reset();
          regionOtherInput.style.display = "none";
          
          // '다른 사람 의견 보기' 탭으로 자동 전환 및 활성화
          document.querySelector('.tab-btn[data-target="submissions"]').click();
        } else {
          throw new Error(result.message || '서버에서 오류가 발생했습니다.');
        }
      } else {
        throw new Error(`HTTP 오류: ${response.status}`);
      }

    } catch (error) {
      console.error('제출 오류:', error);
      msg.textContent = `⚠️ 제출 실패: ${error.message}`;
      
    } finally {
      // 💡 성공/실패와 관계없이 잠금 해제 및 버튼 활성화
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = "제출하기";
    }
  });

  // 3. submissions 렌더링 (displayKeys 적용)
  const renderSubmissions = () => {
    submissionsList.innerHTML = "";

    if (localSubmissions.length === 0) {
      submissionsList.innerHTML = '<div class="placeholder">아직 제출된 기록이 없습니다.</div>';
      return;
    }

    // 최신 10개만 표시
    localSubmissions.slice().reverse().slice(0, 10).forEach((sub, index) => {
      const card = document.createElement("div");
      card.className = "record fade-in";
      card.style.setProperty('--delay', `${index * 0.05}s`);

      let html = displayKeys
        .map(k => {
          const label = keyMap[k];
          let value = sub[k];
          const displayValue = (value && value !== "" && value !== " ") ? value : "응답 없음";
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

  // 4. 탭 클릭 이벤트
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(btn.dataset.target).classList.add("active");

      if (btn.dataset.target === "submissions") {
        fetchSubmissions();
      }
    });
  });

  // 5. "기타" 입력 토글
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
