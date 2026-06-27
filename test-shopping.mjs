import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = `file:///${__dirname.replace(/\\/g, '/')}/shopping-list.html`;

let passed = 0;
let failed = 0;

function ok(label, condition) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function addItem(page, text) {
  await page.fill('#itemInput', text);
  await page.click('#addBtn');
  await page.waitForTimeout(100);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(FILE_URL);
  await page.waitForLoadState('domcontentloaded');

  // localStorage 초기화
  await page.evaluate(() => localStorage.removeItem('shopping'));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  // ─────────────────────────────────────────
  console.log('\n📋 [1] 초기 상태 확인');
  // ─────────────────────────────────────────
  const totalInit = await page.textContent('#totalCount');
  ok('전체 카운트 0', totalInit.trim() === '0');

  const emptyMsg = await page.locator('.empty').textContent();
  ok('빈 목록 메시지 표시', emptyMsg.includes('추가해'));

  // ─────────────────────────────────────────
  console.log('\n📋 [2] 아이템 추가');
  // ─────────────────────────────────────────
  await addItem(page, '우유');
  await addItem(page, '계란');
  await addItem(page, '사과');

  const items = await page.locator('.item').count();
  ok('아이템 3개 추가됨', items === 3);

  const totalAfterAdd = await page.textContent('#totalCount');
  ok('전체 카운트 3', totalAfterAdd.trim() === '3');

  const remainAfterAdd = await page.textContent('#remainCount');
  ok('남은 카운트 3', remainAfterAdd.trim() === '3');

  // Enter 키로 추가
  await page.fill('#itemInput', '빵');
  await page.press('#itemInput', 'Enter');
  await page.waitForTimeout(100);
  const totalAfterEnter = await page.textContent('#totalCount');
  ok('Enter 키로 추가 (전체 4)', totalAfterEnter.trim() === '4');

  // 빈 입력 추가 시도 (추가 안 됨)
  await page.fill('#itemInput', '   ');
  await page.click('#addBtn');
  await page.waitForTimeout(100);
  const totalAfterEmpty = await page.textContent('#totalCount');
  ok('공백만 입력 시 추가 안 됨 (전체 4)', totalAfterEmpty.trim() === '4');

  // ─────────────────────────────────────────
  console.log('\n📋 [3] 체크(완료) 기능');
  // ─────────────────────────────────────────
  // 첫 번째 아이템 체크 (목록이 최근 추가 순이므로 '빵')
  const firstCheck = page.locator('.check-btn').first();
  await firstCheck.click();
  await page.waitForTimeout(100);

  const firstItemDone = await page.locator('.item').first().getAttribute('class');
  ok('첫 번째 아이템 완료 표시', firstItemDone.includes('done'));

  const doneCount = await page.textContent('#doneCount');
  ok('완료 카운트 1', doneCount.trim() === '1');

  const remainCount = await page.textContent('#remainCount');
  ok('남은 카운트 3', remainCount.trim() === '3');

  // 두 번째 아이템도 체크
  await page.locator('.check-btn').nth(1).click();
  await page.waitForTimeout(100);
  const doneCount2 = await page.textContent('#doneCount');
  ok('완료 카운트 2', doneCount2.trim() === '2');

  // 체크 해제 (토글)
  await page.locator('.check-btn').first().click();
  await page.waitForTimeout(100);
  const doneCount3 = await page.textContent('#doneCount');
  ok('체크 해제로 완료 카운트 1로 감소', doneCount3.trim() === '1');

  const firstItemUndone = await page.locator('.item').first().getAttribute('class');
  ok('첫 번째 아이템 미완료로 복원', !firstItemUndone.includes('done'));

  // ─────────────────────────────────────────
  console.log('\n📋 [4] 필터 기능');
  // ─────────────────────────────────────────
  // 완료 필터
  await page.click('.filter-btn[data-filter="done"]');
  await page.waitForTimeout(100);
  const doneItems = await page.locator('.item').count();
  ok('완료 필터: 완료된 아이템만 표시 (1개)', doneItems === 1);

  // 미완료 필터
  await page.click('.filter-btn[data-filter="active"]');
  await page.waitForTimeout(100);
  const activeItems = await page.locator('.item').count();
  ok('미완료 필터: 미완료 아이템만 표시 (3개)', activeItems === 3);

  // 전체 필터
  await page.click('.filter-btn[data-filter="all"]');
  await page.waitForTimeout(100);
  const allItems = await page.locator('.item').count();
  ok('전체 필터: 모든 아이템 표시 (4개)', allItems === 4);

  // ─────────────────────────────────────────
  console.log('\n📋 [5] 아이템 삭제');
  // ─────────────────────────────────────────
  // 현재 상태: 빵(미완료), 사과(완료), 계란(미완료), 우유(미완료)
  // 미완료 아이템(첫 번째) 삭제
  await page.locator('.item:not(.done) .del-btn').first().click();
  await page.waitForTimeout(100);
  const totalAfterDel = await page.textContent('#totalCount');
  ok('미완료 아이템 삭제 후 전체 3개', totalAfterDel.trim() === '3');

  // 완료된 아이템 삭제 (done 상태인 아이템의 del-btn)
  const doneItem = page.locator('.item.done .del-btn').first();
  await doneItem.click();
  await page.waitForTimeout(100);
  const totalAfterDelDone = await page.textContent('#totalCount');
  ok('완료된 아이템 삭제 후 전체 2개', totalAfterDelDone.trim() === '2');
  const doneCountAfter = await page.textContent('#doneCount');
  ok('완료 카운트도 0으로 감소', doneCountAfter.trim() === '0');

  // ─────────────────────────────────────────
  console.log('\n📋 [6] 완료 항목 일괄 삭제');
  // ─────────────────────────────────────────
  // 아이템 추가 후 2개 체크
  await addItem(page, '오렌지');
  await addItem(page, '포도');
  await addItem(page, '딸기');
  await page.locator('.check-btn').first().click();
  await page.waitForTimeout(100);
  await page.locator('.check-btn').nth(1).click();
  await page.waitForTimeout(100);

  const beforeClear = await page.textContent('#totalCount');
  ok('일괄삭제 전 전체 5개', beforeClear.trim() === '5');

  await page.click('#clearDone');
  await page.waitForTimeout(100);
  const afterClear = await page.textContent('#totalCount');
  ok('완료 항목 일괄 삭제 후 3개 남음', afterClear.trim() === '3');
  const doneAfterClear = await page.textContent('#doneCount');
  ok('완료 카운트 0', doneAfterClear.trim() === '0');

  // ─────────────────────────────────────────
  console.log('\n📋 [7] localStorage 영속성');
  // ─────────────────────────────────────────
  const countBeforeReload = await page.textContent('#totalCount');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const countAfterReload = await page.textContent('#totalCount');
  ok('새로고침 후 데이터 유지', countBeforeReload.trim() === countAfterReload.trim());

  // ─────────────────────────────────────────
  // 결과 요약
  // ─────────────────────────────────────────
  console.log('\n' + '─'.repeat(45));
  console.log(`결과: ${passed + failed}개 테스트 중 ${passed}개 통과, ${failed}개 실패`);
  console.log('─'.repeat(45));

  if (failed === 0) {
    console.log('🎉 모든 테스트 통과!');
  } else {
    console.log(`⚠️  ${failed}개 테스트 실패`);
  }

  await page.waitForTimeout(1500);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
