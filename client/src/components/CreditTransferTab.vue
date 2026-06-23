<script setup>
import { ref, onMounted } from 'vue'

const BASE_URL = ''

// ⭐ 新增：控制抵免流程圖展開或收闔的開關（預設為 true 展開）
const showWorkflow = ref(true)

// ── 1. 莫蘭迪學術風：標準抵免跑單流程指南資料 ──────────────────────────────
const steps = [
  {
    step: '01',
    title: '系網課綱蒐集',
    icon: '🖨️',
    color: 'from-sky-600 to-cyan-700',
    desc: '先至原學校的系網下載並「列印」以前修過科目的完整每週課程大綱。',
    tip: '務必確認課綱有註明上課時數與學分數，部分系所會要求蓋原校戳章。'
  },
  {
    step: '02',
    title: '專業科目系辦初審',
    icon: '👩‍💼',
    color: 'from-teal-600 to-emerald-700',
    desc: '攜帶課綱與歷年成績單正本，至「你考上的學系系辦」找系助確認專業科目抵免。',
    tip: '先禮貌詢問系助是否需填寫紙本草稿單，把科目名稱完全對照清楚。'
  },
  {
    step: '03',
    title: '共同科目分流核章',
    icon: '🏛️',
    color: 'from-amber-600 to-orange-700',
    desc: '通識課送「通識教育中心」、英文課送「外語教學中心」辦理審查。',
    tip: '⏰ 避開白跑地雷：行政人員上班時間為 週一至五 08:30-12:00 / 13:30-17:00 (中午全校閉館午休)！'
  },
  {
    step: '04',
    title: '帶回所屬系辦覆核',
    icon: '👨‍🏫',
    color: 'from-indigo-600 to-violet-700',
    desc: '外系與各中心主管全數核章完畢後，把整份抵免單「帶回所屬系辦」。',
    tip: '交由系管理員作最終覆核與蓋章，確認畢業學分總表上的門檻歸類。'
  },
  {
    step: '05',
    title: '送交至註冊課務組',
    icon: '📑',
    color: 'from-rose-600 to-red-700',
    desc: '表定規定期限（8月5日至9月12日）內，將紙本親送達資電館1樓註冊課務組櫃檯。逾期不受理。',
    tip: '送交前建議用手機把整份蓋滿章的表單正反面拍照留底，以防單據遺失。'
  },
  {
    step: '06',
    title: '靜待成果轉入查詢',
    icon: '⏳',
    color: 'from-slate-700 to-slate-900',
    desc: '繳交後過大概「 1 或 2 個月左右 」，自行登入 MyFCU 畢業學分審核系統確認轉入成果。',
    tip: '若11月期中考前仍未看到學分轉入，請攜帶存根聯照片至資電1樓櫃檯查詢。'
  }
]

// ── 2. 經驗列表與搜尋過濾狀態 ──────────────────────────────────────────
const records      = ref([])
const loading      = ref(false)
const error        = ref(null)
const searchQuery  = ref('')
const statusFilter = ref('all')
let   searchTimer  = null

// ── 3. Modal 與回報表單狀態 ────────────────────────────────────────────
const showModal     = ref(false)
const submitting    = ref(false)
const submitError   = ref(null)
const submitSuccess = ref(false)

const form = ref({
  original_school:  '',
  original_dept:    '',
  original_course:  '',
  credits:          '',
  target_course:    '',
  status:           '通過',
  advice:           '',
})

const formErrors = ref({})

// 撈取抵免資料
async function fetchRecords() {
  loading.value = true
  error.value   = null
  try {
    const params = new URLSearchParams()
    if (searchQuery.value.trim()) params.set('q', searchQuery.value.trim())
    if (statusFilter.value !== 'all') params.set('status', statusFilter.value)
    const res = await fetch(`${BASE_URL}/api/credits?${params.toString()}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    records.value = data.records
  } catch (e) {
    error.value = `載入失敗：${e.message}，請確認後端服務是否啟動。`
  } finally {
    loading.value = false
  }
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(fetchRecords, 350)
}

function onFilterChange() {
  fetchRecords()
}

const statusConfig = {
  '通過':     { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold',  icon: '✅' },
  '需補課綱': { badge: 'bg-amber-100 text-amber-800 border-amber-300 font-bold', icon: '⚠️' },
  '駁回':     { badge: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',        icon: '❌' },
}

function getStatusConfig(s) {
  return statusConfig[s] ?? { badge: 'bg-slate-100 text-slate-600 border-slate-200', icon: '❓' }
}

function formatDate(str) {
  if (!str) return '—'
  return str.slice(0, 10)
}

// ── Modal 處理函數 ────────────────────────────────────────────────────────
function openModal() {
  form.value = {
    original_school: '', original_dept: '', original_course: '',
    credits: '', target_course: '', status: '通過', advice: '',
  }
  formErrors.value  = {}
  submitError.value = null
  submitSuccess.value = false
  showModal.value   = true
}

function closeModal() { showModal.value = false }

function validateForm() {
  const errs = {}
  if (!form.value.original_school.trim())  errs.original_school = '請填寫原就讀學校'
  if (!form.value.original_dept.trim())    errs.original_dept   = '請填寫原就讀科系'
  if (!form.value.original_course.trim())  errs.original_course = '請填寫原修課名稱'
  if (!form.value.target_course.trim())    errs.target_course   = '請填寫申請抵免科目'
  const c = parseInt(form.value.credits, 10)
  if (!form.value.credits || isNaN(c) || c < 1 || c > 10) {
    errs.credits = '學分數請填寫 1–10 的整數'
  }
  formErrors.value = errs
  return Object.keys(errs).length === 0
}

async function submitForm() {
  if (!validateForm()) return

  submitting.value  = true
  submitError.value = null

  try {
    const res = await fetch(`${BASE_URL}/api/credits`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_school: form.value.original_school.trim(),
        original_dept:   form.value.original_dept.trim(),
        original_course: form.value.original_course.trim(),
        credits:         parseInt(form.value.credits, 10),
        target_course:   form.value.target_course.trim(),
        status:          form.value.status,
        advice:          form.value.advice.trim() || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)

    records.value.unshift(data.record)
    submitSuccess.value = true
    setTimeout(() => { closeModal() }, 1200)
  } catch (e) {
    submitError.value = `送出失敗：${e.message}`
  } finally {
    submitting.value = false
  }
}

onMounted(fetchRecords)
</script>

<template>
  <div class="font-sans text-slate-800 space-y-8 pb-12">
    
    <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
      <div class="absolute -right-10 -bottom-10 opacity-10 text-9xl pointer-events-none font-black">FCU</div>
      <div class="max-w-2xl relative z-10">
        <span class="px-3 py-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-full text-xs font-black tracking-widest uppercase mb-3 inline-block">
          Official Workflow Guide
        </span>
        <h2 class="text-3xl font-black tracking-tight text-white">逢甲大學轉學生 ‧ 學分抵免通關指南</h2>
        <p class="text-sm text-slate-300 mt-2 font-medium leading-relaxed">
          抵免學分是一場考驗耐心的校園公文跑酷。請嚴格參照以下六大標準步驟辦理，務必留意各教學行政單位之開放時段。
        </p>
      </div>
    </div>

    <div class="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-md transition-all duration-300">
      
      <div class="flex items-center justify-between flex-wrap gap-4" :class="[showWorkflow ? 'mb-8 pb-4 border-b border-slate-100' : '']">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🗺️</span>
          <h3 class="text-xl font-black text-slate-900">標準紙本抵免跑單流程圖 (Step-by-Step)</h3>
        </div>
        
        <button
          @click="showWorkflow = !showWorkflow"
          :class="[
            'flex items-center gap-1.5 px-4 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 shadow-2xs cursor-pointer',
            showWorkflow 
              ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700' 
              : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
          ]"
        >
          <span>{{ showWorkflow ? '🗂️' : '📂' }}</span>
          <span>{{ showWorkflow ? '收起流程圖 ✕' : '展開流程指南' }}</span>
        </button>
      </div>

      <div v-if="showWorkflow" class="relative border-l-4 border-slate-100 ml-4 sm:ml-8 space-y-8 py-2 animation-fade-in">
        <div v-for="(s, index) in steps" :key="s.step" class="relative pl-6 sm:pl-10 group">
          
          <div :class="[
            'absolute -left-[21px] sm:-left-[25px] top-1.5 w-10 sm:w-11 h-10 sm:h-11 rounded-2xl bg-gradient-to-br text-white font-black flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110',
            s.color
          ]">
            <span class="text-sm sm:text-base">{{ s.step }}</span>
          </div>

          <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:bg-white hover:shadow-xl hover:border-slate-300">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h4 class="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{{ s.icon }}</span><span>{{ s.title }}</span>
              </h4>
              <span v-if="index === 2" class="px-2.5 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 rounded-md text-xs font-black animate-pulse">
                ⚠️ 嚴防午休閉館
              </span>
              <span v-else-if="index === 4" class="px-2.5 py-0.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-md text-xs font-black">
                ⌛ 9/12 17:00 截止
              </span>
            </div>

            <p class="text-xs sm:text-sm text-slate-700 font-bold leading-relaxed mb-3">{{ s.desc }}</p>

            <div :class="['p-3 rounded-xl text-xs font-black leading-normal flex items-start gap-2 border', index === 2 ? 'bg-amber-500/10 text-amber-900 border-amber-500/30' : 'bg-slate-200/50 text-slate-600 border-slate-300/60']">
              <span class="mt-0.5">💡</span><span class="flex-1">{{ s.tip }}</span>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-md">
      
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div>
          <h3 class="text-xl font-black text-slate-900 flex items-center gap-2">
            <span>📚</span> 前人抵免經驗資料庫
          </h3>
          <p class="text-xs text-slate-500 font-medium mt-1">搜尋學長姐的回報紀錄，查詢各系教授審核課綱的嚴格程度。</p>
        </div>

        <button
          @click="openModal"
          class="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl shadow-md transition-all duration-200 cursor-pointer hover:scale-105"
        >
          <span>➕</span><span>回報我的抵免經驗</span>
        </button>
      </div>

      <div class="flex flex-wrap sm:flex-nowrap gap-3 mb-6">
        <div class="relative flex-1 min-w-[200px]">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            type="text"
            placeholder="搜尋原學校、科系或科目名稱..."
            class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
          />
        </div>

        <select
          v-model="statusFilter"
          @change="onFilterChange"
          class="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-extrabold bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer min-w-[140px]"
        >
          <option value="all">全部審核狀態</option>
          <option value="通過">✅ 通過</option>
          <option value="需補課綱">⚠️ 需補課綱</option>
          <option value="駁回">❌ 駁回</option>
        </select>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-16 text-slate-400 font-bold">
        <span class="text-3xl mr-3 animate-spin">⏳</span><span>載入抵免紀錄中...</span>
      </div>

      <div v-else-if="error" class="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-bold">
        ❌ {{ error }}
      </div>

      <div v-else-if="records.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400">
        <span class="text-5xl mb-3">📭</span>
        <p class="font-bold text-sm">找不到符合條件的抵免紀錄</p>
        <p class="text-xs mt-1">試試調整搜尋關鍵字或篩選條件？</p>
      </div>

      <div v-else class="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-900 text-white text-[11px] uppercase tracking-wider font-mono">
                <th class="p-4 font-bold">原就讀校系</th>
                <th class="p-4 font-bold">原修科目 (學分數)</th>
                <th class="p-4 font-bold">申請抵免本校科目</th>
                <th class="p-4 font-bold">審核結果</th>
                <th class="p-4 font-bold">學長姐經驗備註</th>
                <th class="p-4 font-bold whitespace-nowrap">回報日期</th>
              </tr>
            </thead>
            <tbody class="text-xs divide-y divide-slate-100 font-medium text-slate-700">
              <tr v-for="rec in records" :key="rec.id" class="hover:bg-slate-50/80 transition">
                <td class="p-4 align-top">
                  <div class="font-black text-slate-900">{{ rec.original_school }}</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">{{ rec.original_dept }}</div>
                </td>
                <td class="p-4 align-top whitespace-nowrap">
                  <span class="font-bold">{{ rec.original_course }}</span>
                  <span class="ml-1.5 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono font-bold">
                    {{ rec.credits }} 學分
                  </span>
                </td>
                <td class="p-4 align-top font-black text-indigo-950">{{ rec.target_course }}</td>
                <td class="p-4 align-top whitespace-nowrap">
                  <span :class="['inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border', getStatusConfig(rec.status).badge]">
                    <span>{{ getStatusConfig(rec.status).icon }}</span><span>{{ rec.status }}</span>
                  </span>
                </td>
                <td class="p-4 align-top leading-relaxed max-w-xs text-slate-600 font-normal">
                  {{ rec.advice ?? '—' }}
                </td>
                <td class="p-4 align-top text-slate-400 font-mono text-[11px] whitespace-nowrap">
                  {{ formatDate(rec.created_at) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 font-bold text-right">
          共收錄 {{ records.length }} 筆經驗紀錄
        </div>
      </div>

    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          
          <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="closeModal" />

          <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div class="bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white flex items-center justify-between">
              <div>
                <h3 class="text-lg font-black flex items-center gap-2"><span>📝</span> 回報學分抵免歷史經驗</h3>
                <p class="text-xs text-slate-300 mt-0.5 font-medium">你的回報將成為下一屆學弟妹的通關燈塔</p>
              </div>
              <button @click="closeModal" class="text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            </div>

            <div v-if="submitSuccess" class="m-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-xs font-black text-center animate-pulse">
              ✅ 經驗回報成功！資料庫已即時更新，視窗關閉中...
            </div>

            <div v-if="submitError" class="mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-bold">
              {{ submitError }}
            </div>

            <form @submit.prevent="submitForm" class="p-6 space-y-4 overflow-y-auto flex-1 text-xs font-bold">
              
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-700 mb-1">原就讀學校 <span class="text-rose-500">*</span></label>
                  <input v-model="form.original_school" type="text" placeholder="例：輔仁大學" :class="['w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2', formErrors.original_school ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-500']" />
                  <p v-if="formErrors.original_school" class="text-rose-500 text-[11px] mt-1">{{ formErrors.original_school }}</p>
                </div>
                <div>
                  <label class="block text-slate-700 mb-1">原就讀科系 <span class="text-rose-500">*</span></label>
                  <input v-model="form.original_dept" type="text" placeholder="例：資訊工程系" :class="['w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2', formErrors.original_dept ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-500']" />
                  <p v-if="formErrors.original_dept" class="text-rose-500 text-[11px] mt-1">{{ formErrors.original_dept }}</p>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                  <label class="block text-slate-700 mb-1">原修課科目名稱 <span class="text-rose-500">*</span></label>
                  <input v-model="form.original_course" type="text" placeholder="例：資料結構與演算法" :class="['w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2', formErrors.original_course ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-500']" />
                  <p v-if="formErrors.original_course" class="text-rose-500 text-[11px] mt-1">{{ formErrors.original_course }}</p>
                </div>
                <div>
                  <label class="block text-slate-700 mb-1">學分數 <span class="text-rose-500">*</span></label>
                  <input v-model="form.credits" type="number" min="1" max="10" placeholder="3" :class="['w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 font-mono', formErrors.credits ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-500']" />
                  <p v-if="formErrors.credits" class="text-rose-500 text-[11px] mt-1">{{ formErrors.credits }}</p>
                </div>
              </div>

              <div>
                <label class="block text-slate-700 mb-1">申請抵免逢甲對應科目 <span class="text-rose-500">*</span></label>
                <input v-model="form.target_course" type="text" placeholder="例：演算法設計" :class="['w-full p-2.5 border rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2', formErrors.target_course ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300 focus:ring-teal-500']" />
                <p v-if="formErrors.target_course" class="text-rose-500 text-[11px] mt-1">{{ formErrors.target_course }}</p>
              </div>

              <div>
                <label class="block text-slate-700 mb-1">最終審核判定結果 <span class="text-rose-500">*</span></label>
                <div class="grid grid-cols-3 gap-2">
                  <label v-for="opt in ['通過', '需補課綱', '駁回']" :key="opt" :class="['flex items-center justify-center gap-1 p-2.5 rounded-xl border cursor-pointer transition', form.status === opt ? (opt==='通過'?'bg-emerald-50 border-emerald-500 text-emerald-800 font-black':'bg-amber-50 border-amber-500 text-amber-800 font-black') : 'border-slate-200 text-slate-500 hover:bg-slate-50']">
                    <input type="radio" :value="opt" v-model="form.status" class="sr-only" />
                    <span>{{ getStatusConfig(opt).icon }}</span><span>{{ opt }}</span>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-slate-700 mb-1">通關經驗備註 <span class="text-slate-400 font-normal">(選填，強烈建議留下申請細節與系助態度)</span></label>
                <textarea v-model="form.advice" rows="3" placeholder="例：直接帶課綱去資電館1樓，櫃檯當場蓋章，千萬別挑中午去會沒人！" class="w-full p-3 border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 font-normal"></textarea>
              </div>

              <div class="flex gap-3 pt-3 pb-1">
                <button type="button" @click="closeModal" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition cursor-pointer">
                  取消
                </button>
                <button type="submit" :disabled="submitting || submitSuccess" class="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow-lg transition cursor-pointer">
                  {{ submitting ? '⏳ 寫入資料庫中...' : (submitSuccess ? '✅ 回報成功' : '確認送出回報') }}
                </button>
              </div>

            </form>
          </div>

        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.25s ease; }
.modal-enter-active .relative, .modal-leave-active .relative { transition: transform 0.25s ease, opacity 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative { transform: scale(0.95) translateY(12px); opacity: 0; }

/* 簡單平滑的漸顯動畫 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.animation-fade-in {
  animation: fadeIn 0.3s ease-out forwards;
}
</style>