<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const BASE_URL = ''
const simulatedToday = ref('2025-08-10')

// 登入與註冊共用 Modal 狀態
const currentUser = ref(null)
const showAuthModal = ref(false)
const isLoginMode = ref(true) // true = 登入畫面, false = 註冊畫面

const authForm = ref({
  username: '',
  password: '',
  name: '',      // 註冊用：姓名
  grade: 2       // 註冊用：轉入年級
})
const authLoading = ref(false)
const authError = ref('')

const selectedGrade = ref(null)
const items         = ref([])
const loading       = ref(false)
const error         = ref(null)

const showMap = ref(false)
const selectedBuilding = ref(null)

// 主後台發布艙
const teacherMode = ref(false)
const submittingTask = ref(false)
const newTask = ref({
  target_grade: 2, category: '選課規劃', text: '',
  is_required: true, deadline: '2025-08-31', building: '資訊電機館', office_phone: '分機2111'
})

const buildingCoords = {
  '育樂館': { top: '41%', left: '18%' }, '資訊電機館': { top: '58%', left: '60%' },
  '行政二館': { top: '71%', left: '26%' }, '行政大樓': { top: '70%', left: '17%' },
  '商學大樓': { top: '72%', left: '56%' }, '丘逢甲紀念館': { top: '75%', left: '38%' },
  '圖書館': { top: '70%', left: '48%' }, '語文大樓': { top: '51%', left: '18%' },
  '忠勤樓': { top: '59%', left: '18%' }, '工學館': { top: '59%', left: '33%' }, '人言大樓': { top: '51%', left: '44%' },
}

const isAdmin = computed(() => currentUser.value?.role === 'admin')

function isExpired(deadline) { return new Date(simulatedToday.value) > new Date(deadline) }

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => {
    const aDoneOrExpired = a.is_completed || isExpired(a.deadline)
    const bDoneOrExpired = b.is_completed || isExpired(b.deadline)
    if (aDoneOrExpired && !bDoneOrExpired) return 1
    if (!aDoneOrExpired && bDoneOrExpired) return -1
    return new Date(a.deadline) - new Date(b.deadline)
  })
})

const completedCount = computed(() => items.value.filter(i => i.is_completed).length)
const progressPct = computed(() => items.value.length === 0 ? 0 : Math.round((completedCount.value / items.value.length) * 100))
const progressBarColor = computed(() => progressPct.value === 100 ? 'bg-emerald-600' : (progressPct.value >= 60 ? 'bg-teal-500' : 'bg-slate-700'))

async function fetchChecklist(grade) {
  loading.value = true; error.value = null; items.value = []; selectedBuilding.value = null; showMap.value = false
  try {
    const uid = currentUser.value?.id || ''
    const res = await fetch(`${BASE_URL}/api/checklist?grade=${grade}&userId=${uid}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    items.value = (await res.json()).items
  } catch (e) { error.value = `資料載入失敗：${e.message}` } finally { loading.value = false }
}

watch(selectedGrade, (grade) => { if (grade) fetchChecklist(grade) })

// 打勾發送進度
async function toggleTask(item) {
  if (!currentUser.value) {
    authError.value = '👉 請先登入或註冊帳號，系統才能為您雲端記憶打勾進度喔！'
    isLoginMode.value = true
    showAuthModal.value = true
    return
  }
  if (isAdmin.value) return alert('管理員您好，進度打勾為學生端視角功能。')

  item.is_completed = !item.is_completed
  selectedBuilding.value = item.building; showMap.value = true

  try {
    await fetch(`${BASE_URL}/api/checklist/progress`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.value.id, task_id: item.id, is_completed: item.is_completed })
    })
  } catch (e) { console.error('進度上傳失敗:', e) }
}

// ⭐ 管理員刪除任務
async function handleDeleteTask(id, event) {
  event.stopPropagation() // 阻止冒泡觸發打勾
  if (!confirm('確定要永久刪除這條校園任務嗎？')) return

  try {
    const res = await fetch(`${BASE_URL}/api/checklist/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await res.text())
    items.value = items.value.filter(i => i.id !== id)
    alert('🗑️ 任務已刪除！')
  } catch (e) { alert(`刪除失敗: ${e.message}`) }
}

function locateBuilding(building, event) { event.stopPropagation(); selectedBuilding.value = building; showMap.value = true }

// ⭐ 執行登入或註冊 (送出後確保即時刷新清單進度)
async function handleAuthSubmit() {
  authLoading.value = true; authError.value = ''
  const endpoint = isLoginMode.value ? '/api/login' : '/api/register'
  
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(authForm.value)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '驗證發生錯誤')

    currentUser.value = data.user
    showAuthModal.value = false
    authForm.value = { username: '', password: '', name: '', grade: 2 }

    if (data.user.role === 'student') {
      selectedGrade.value = data.user.grade || 2
    } else if (!selectedGrade.value) {
      selectedGrade.value = 2
    }
    fetchChecklist(selectedGrade.value) // 登入成功當場無縫載入該生打勾紀錄！
  } catch (e) { authError.value = e.message } finally { authLoading.value = false }
}

function handleLogout() { currentUser.value = null; teacherMode.value = false; if (selectedGrade.value) fetchChecklist(selectedGrade.value) }

async function handleCreateTask() {
  if (!newTask.value.text.trim()) return alert('請填寫任務說明！')
  submittingTask.value = true
  try {
    const res = await fetch(`${BASE_URL}/api/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTask.value) })
    if (!res.ok) throw new Error(await res.text())
    alert('🎉 新任務廣播成功！'); newTask.value.text = ''
    if (selectedGrade.value) fetchChecklist(selectedGrade.value)
  } catch (e) { alert(`發布失敗: ${e.message}`) } finally { submittingTask.value = false }
}

const categoryColors = {
  '兵役與證件': 'bg-rose-50 text-rose-700 border-rose-200', '帳號申請': 'bg-sky-50 text-sky-700 border-sky-200',
  '學分抵免': 'bg-violet-50 text-violet-700 border-violet-200', '健康檢查': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '住宿登記': 'bg-amber-50 text-amber-700 border-amber-200', '選課規劃': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  '社群加入': 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', '畢業學分確認': 'bg-orange-50 text-orange-700 border-orange-200', '書卷與助學金': 'bg-teal-50 text-teal-700 border-teal-200',
}
function getCategoryColor(cat) { return categoryColors[cat] ?? 'bg-slate-100 text-slate-600 border-slate-200' }

onMounted(() => { selectedGrade.value = 2 })
</script>

<template>
  <div class="font-sans text-slate-800">
    
    <div class="mb-6 pb-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-4">
      <div>
        <h2 class="text-2xl font-extrabold text-slate-900 flex items-center gap-2"><span>📋</span> 暑假轉學生 ‧ 開學重要日程檢核殿堂</h2>
        <p class="text-xs font-semibold text-slate-500 mt-1">Feng Chia University Transfer Hub &nbsp;|&nbsp; 點選任務展開地圖</p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <div class="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
          <span class="text-xs font-bold text-slate-600">⏳ 模擬日期：</span>
          <input type="date" v-model="simulatedToday" class="bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer" />
        </div>

        <button @click="showMap = !showMap" :class="['flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition shadow-sm cursor-pointer', showMap ? 'bg-slate-900 text-amber-400 border-slate-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50']">
          <span>🗺️</span><span>{{ showMap ? '關閉地圖 ✕' : '校園導航' }}</span>
        </button>

        <div v-if="currentUser" class="flex items-center gap-2 bg-slate-900 text-white pl-3 pr-1.5 py-1 rounded-lg shadow-md border border-slate-800">
          <span class="text-xs font-bold flex items-center gap-1"><span class="text-emerald-400">●</span><span>{{ currentUser.name }}</span></span>
          <button v-if="isAdmin" @click="teacherMode = !teacherMode" :class="['px-2 py-0.5 rounded text-xs font-extrabold transition cursor-pointer', teacherMode ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-400/30']">
            ⚡ {{ teacherMode ? '關閉推送艙' : '管理員發布台' }}
          </button>
          <button @click="handleLogout" class="bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer">登出</button>
        </div>

        <button v-else @click="showAuthModal = true; isLoginMode = true" class="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-lg font-bold text-xs shadow transition cursor-pointer animate-pulse">
          <span>🔒</span><span>登入 / 註冊新帳號</span>
        </button>
      </div>
    </div>

    <div v-if="showAuthModal" class="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all">
      <div class="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button @click="showAuthModal = false" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer">✕</button>
        
        <!-- 頂部切換 Tab -->
        <div class="flex grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6">
          <button @click="isLoginMode = true; authError = ''" :class="['py-2 rounded-lg text-xs font-extrabold transition cursor-pointer', isLoginMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-900']">
            現有帳號登入
          </button>
          <button @click="isLoginMode = false; authError = ''" :class="['py-2 rounded-lg text-xs font-extrabold transition cursor-pointer', !isLoginMode ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-900']">
            轉學生新帳號註冊
          </button>
        </div>

        <div class="text-center mb-5">
          <span class="text-4xl inline-block mb-1">{{ isLoginMode ? '👋' : '✨' }}</span>
          <h3 class="text-xl font-black text-slate-900">{{ isLoginMode ? '歡迎回來 ‧ 登入殿堂' : '建立您的轉學專屬進度卡' }}</h3>
        </div>

        <div v-if="authError" class="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
          <span>⚠️</span><span>{{ authError }}</span>
        </div>

        <form @submit.prevent="handleAuthSubmit" class="space-y-3.5">
          <div v-if="!isLoginMode">
            <label class="block text-xs font-bold text-slate-700 mb-1">您的真實姓名</label>
            <input type="text" v-model="authForm.name" :required="!isLoginMode" placeholder="例：王小明" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">帳號 (請設定您的學號)</label>
            <input type="text" v-model="authForm.username" required placeholder="例：d1140555" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <div v-if="!isLoginMode">
            <label class="block text-xs font-bold text-slate-700 mb-1">您考取轉入的年級</label>
            <select v-model="authForm.grade" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500">
              <option :value="2">大二轉學生 (升大二)</option>
              <option :value="3">大三轉學生 (升大三)</option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">登入密碼</label>
            <input type="password" v-model="authForm.password" required placeholder="••••••••" class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>

          <button type="submit" :disabled="authLoading" class="w-full mt-2 py-3 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm rounded-xl shadow-lg transition cursor-pointer">
            {{ authLoading ? '傳送中...' : (isLoginMode ? '確認登入' : '立即註冊並登入') }}
          </button>
        </form>
      </div>
    </div>

    <div class="flex gap-3 mb-6">
      <button v-for="g in [{ value: 2, label: '大二轉學生清單 (升大二)' }, { value: 3, label: '大三轉學生清單 (升大三)' }]" :key="g.value" @click="selectedGrade = g.value" :class="['px-5 py-2.5 rounded-xl border text-sm font-extrabold transition shadow-sm cursor-pointer', selectedGrade === g.value ? 'border-slate-900 bg-slate-900 text-white shadow-md' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400']">
        {{ g.label }}
      </button>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20 text-slate-400 font-bold"><span class="text-3xl mr-3 animate-spin">⏳</span><span>雲端資料同步中...</span></div>
    <div v-else-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm font-bold">❌ {{ error }}</div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <div :class="[showMap ? 'lg:col-span-7' : 'lg:col-span-12', 'flex flex-col gap-4 transition-all duration-300']">
        
        <div v-if="teacherMode && isAdmin" class="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-amber-400/40 rounded-2xl p-5 text-white shadow-xl mb-2">
          <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2.5">
            <span class="font-black text-base text-amber-400 flex items-center gap-2"><span class="text-xl">📢</span> 註冊課務組 ‧ 任務推送艙</span>
            <span class="text-xs bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black">ADMIN</span>
          </div>

          <form @submit.prevent="handleCreateTask" class="space-y-3 text-slate-900 font-medium">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div><label class="block text-xs font-bold text-slate-300 mb-1">梯次對象</label><select v-model="newTask.target_grade" class="w-full bg-slate-100 border-0 rounded-xl p-2 text-xs font-bold"><option :value="2">大二清單</option><option :value="3">大三清單</option></select></div>
              <div><label class="block text-xs font-bold text-slate-300 mb-1">業務歸類</label><select v-model="newTask.category" class="w-full bg-slate-100 border-0 rounded-xl p-2 text-xs font-bold"><option v-for="cat in Object.keys(categoryColors)" :key="cat" :value="cat">{{ cat }}</option></select></div>
              <div><label class="block text-xs font-bold text-slate-300 mb-1">截止期限</label><input type="date" v-model="newTask.deadline" class="w-full bg-slate-100 border-0 rounded-xl p-2 text-xs font-bold cursor-pointer" /></div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div><label class="block text-xs font-bold text-slate-300 mb-1">打星定位點</label><select v-model="newTask.building" class="w-full bg-slate-100 border-0 rounded-xl p-2 text-xs font-bold"><option v-for="b in Object.keys(buildingCoords)" :key="b" :value="b">{{ b }}</option></select></div>
              <div><label class="block text-xs font-bold text-slate-300 mb-1">洽詢分機</label><input type="text" v-model="newTask.office_phone" placeholder="例: 分機2111" class="w-full bg-slate-100 border-0 rounded-xl p-2 text-xs font-bold" /></div>
              <div class="flex items-end pb-0.5"><label class="flex items-center gap-2 bg-slate-800 border border-slate-700 p-2 rounded-xl w-full justify-center cursor-pointer hover:bg-slate-700"><input type="checkbox" v-model="newTask.is_required" class="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer" /><span class="text-xs font-black text-amber-400">設為★必辦</span></label></div>
            </div>

            <div><label class="block text-xs font-bold text-slate-300 mb-1">具體作業指示</label><textarea v-model="newTask.text" rows="2" placeholder="撰寫清楚的校園任務說明..." class="w-full bg-slate-100 border-0 rounded-xl p-2.5 text-xs font-semibold focus:bg-white"></textarea></div>
            <button type="submit" :disabled="submittingTask" class="w-full py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer">⚡ 即時廣播發布任務</button>
          </form>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div class="flex justify-between items-center mb-2.5">
            <span class="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><span>📊</span><span>檢核進度總覽 &nbsp;|&nbsp; 綁定帳號：{{ currentUser ? `${currentUser.name}` : '未登入 (唯讀)' }}</span></span>
            <span :class="['text-sm font-black tracking-tight', progressPct === 100 ? 'text-emerald-600' : 'text-teal-600']">{{ completedCount }} / {{ items.length }} ({{ progressPct }}%)</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200"><div :class="['h-3 rounded-full transition-all duration-500 ease-out', progressBarColor]" :style="{ width: progressPct + '%' }" /></div>
        </div>

        <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col divide-y divide-slate-100">
          <div
            v-for="item in sortedItems" :key="item.id" @click="toggleTask(item)"
            :class="['flex items-start gap-4 px-5 py-4 cursor-pointer transition-all duration-300', 'hover:bg-teal-50/40', item.is_completed ? 'bg-slate-50/90 opacity-50' : '', !item.is_completed && isExpired(item.deadline) ? 'bg-rose-50/40 opacity-60' : '', selectedBuilding === item.building && showMap ? 'bg-teal-50 border-l-4 border-l-teal-600 pl-4' : '']"
          >
            <div class="mt-0.5 flex-shrink-0"><div :class="['w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all', item.is_completed ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white']"><span v-if="item.is_completed" class="text-xs font-black">✓</span></div></div>

            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
                <span :class="['text-[11px] px-2.5 py-0.5 rounded-full font-black border', getCategoryColor(item.category)]">{{ item.category }}</span>
                <span v-if="item.is_required" class="text-[11px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-black">★ 必辦</span>

                <button @click="locateBuilding(item.building, $event)" :class="['text-[11px] px-2.5 py-0.5 rounded-md border font-black flex items-center gap-1 transition ml-1', selectedBuilding === item.building && showMap ? 'bg-slate-900 text-amber-400 border-slate-800' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200']">
                  📍 {{ item.building }} {{ item.office_phone ? `(${item.office_phone})` : '' }}
                </button>

                <button 
                  v-if="teacherMode && isAdmin" 
                  @click="handleDeleteTask(item.id, $event)"
                  class="ml-2 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black tracking-wider transition shadow-2xs cursor-pointer animate-pulse"
                >
                  🗑️ 刪除任務
                </button>

                <span :class="['text-[11px] px-2.5 py-0.5 rounded-md font-extrabold border ml-auto', isExpired(item.deadline) && !item.is_completed ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' : 'bg-slate-50 text-slate-500 border-slate-200']">
                  {{ item.is_completed ? '完工' : (isExpired(item.deadline) ? '⚠️ 逾期 (' : '📅 ') }}{{ item.deadline }}{{ !item.is_completed && isExpired(item.deadline) ? ')' : '' }}
                </span>
              </div>
              <p :class="['text-xs sm:text-sm leading-relaxed transition', item.is_completed || isExpired(item.deadline) ? 'line-through text-slate-400' : 'text-slate-800 font-bold']">{{ item.text }}</p>
            </div>
          </div>
        </div>

      </div>

      <div v-if="showMap" class="lg:col-span-5 sticky top-6 transition-all duration-300">
        <div class="bg-slate-900 border-4 border-slate-800 rounded-3xl p-4 shadow-2xl text-white flex flex-col items-center">
          <div class="w-full flex justify-between items-center mb-3 px-1"><span class="text-xs font-black tracking-widest text-amber-400 uppercase">🗺️ 逢甲飛彈導航系統</span><span v-if="selectedBuilding" class="text-xs bg-amber-400 text-slate-950 font-black px-3 py-0.5 rounded-full animate-pulse">鎖定：{{ selectedBuilding }}</span></div>
          <div class="w-full relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 aspect-[4/5] flex items-center justify-center shadow-inner">
            <img src="/campus-map.png" alt="逢甲校園地圖" class="w-full h-full object-cover opacity-90" />
            <div v-if="selectedBuilding && buildingCoords[selectedBuilding]" class="absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 z-10" :style="{ top: buildingCoords[selectedBuilding].top, left: buildingCoords[selectedBuilding].left }"><span class="absolute -inset-2 rounded-full bg-amber-400 opacity-60 animate-ping"></span><span class="absolute inset-0 rounded-full bg-amber-500 opacity-80 animate-pulse"></span><span class="relative flex items-center justify-center w-12 h-12 text-3xl animate-bounce">⭐</span></div>
          </div>
          <div class="w-full flex justify-around items-center text-[11px] font-bold text-slate-400 mt-3 border-t border-slate-800 pt-3"><span>🔴 育樂館: 體檢/報到</span><span>🔵 資電館: 抵免/NID</span><span>🟡 行政二館: 兵役/住宿</span></div>
        </div>
      </div>

    </div>
  </div>
</template>