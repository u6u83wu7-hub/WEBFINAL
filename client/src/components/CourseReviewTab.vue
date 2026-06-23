<script setup>
import { ref, onMounted } from 'vue'
const BASE_URL = ''

const reviews   = ref([])
const loading   = ref(false)
const searchQ   = ref('')
const deptFilter = ref('all')
const showModal = ref(false)
const submitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref(null)
let timer = null

const depts = ['全部學院', '資訊電機學院', '理工學院', '商學院', '人文社會學院', '設計學院', '通識教育中心']

const form = ref({
  course_name: '', teacher: '', dept: '資訊電機學院',
  semester: '113上', rating: 5, difficulty: 3,
  content: '', author: '',
})
const formErrors = ref({})

const difficultyLabel = ['', '極簡單', '簡單', '普通', '困難', '地獄']

function renderStars(n, total = 5) {
  return '★'.repeat(n) + '☆'.repeat(total - n)
}

function ratingColor(n) {
  if (n >= 4) return 'text-emerald-600 font-black'
  if (n >= 3) return 'text-amber-500 font-black'
  return 'text-rose-500 font-black'
}

function diffColor(n) {
  if (n <= 2) return 'bg-emerald-100 text-emerald-800 font-black'
  if (n === 3) return 'bg-amber-100 text-amber-800 font-black'
  return 'bg-rose-100 text-rose-800 font-black'
}

async function fetchReviews() {
  loading.value = true
  try {
    const p = new URLSearchParams()
    if (searchQ.value.trim()) p.set('q', searchQ.value.trim())
    if (deptFilter.value !== 'all') p.set('dept', deptFilter.value)
    const res = await fetch(`${BASE_URL}/api/reviews?${p.toString()}`)
    if (!res.ok) throw new Error('API Error')
    const data = await res.json()
    reviews.value = data.reviews || []
  } catch (e) {
    reviews.value = []
  } finally {
    loading.value = false
  }
}

function onInput() {
  clearTimeout(timer)
  timer = setTimeout(fetchReviews, 350)
}

function validate() {
  const e = {}
  if (!form.value.course_name.trim()) e.course_name = '請填寫課程名稱'
  if (!form.value.teacher.trim())     e.teacher     = '請填寫授課教師'
  if (!form.value.content.trim())     e.content     = '請填寫評價內容'
  formErrors.value = e
  return Object.keys(e).length === 0
}

async function submit() {
  if (!validate()) return
  submitting.value = true
  submitError.value = null
  try {
    const res = await fetch(`${BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form.value,
        author: form.value.author.trim() || '匿名轉學生'
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '發布失敗')
    if (data.review) reviews.value.unshift(data.review)
    submitSuccess.value = true
    setTimeout(() => { showModal.value = false; submitSuccess.value = false }, 1200)
  } catch (e) {
    submitError.value = e.message
  } finally {
    submitting.value = false
  }
}

function openModal() {
  form.value = { course_name:'', teacher:'', dept:'資訊電機學院', semester:'113上', rating:5, difficulty:3, content:'', author:'' }
  formErrors.value = {}; submitError.value = null; submitSuccess.value = false
  showModal.value = true
}

onMounted(fetchReviews)
</script>

<template>
  <div class="space-y-6 text-slate-800 pb-12 font-sans">
    
    <div class="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div>
        <h2 class="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
          <span>⭐</span> 逢甲大學課程真實評價殿堂
        </h2>
        <p class="text-xs font-bold text-slate-500">學長姐修課血淚避雷針，加退選前務必查詢。</p>
      </div>
      <button @click="openModal" class="flex items-center gap-1.5 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-black rounded-2xl shadow transition cursor-pointer">
        <span>✏️</span><span>撰寫修課評價</span>
      </button>
    </div>

    <div class="flex flex-wrap sm:flex-nowrap gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
      <div class="relative flex-1 min-w-[200px]">
        <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input v-model="searchQ" @input="onInput" type="text" placeholder="搜尋課程名稱或教師姓名..."
          class="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800" />
      </div>
      <select v-model="deptFilter" @change="fetchReviews"
        class="px-4 py-2 bg-slate-50 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-slate-800 cursor-pointer min-w-[150px]">
        <option value="all">全校所有學院</option>
        <option v-for="d in depts.slice(1)" :key="d" :value="d">{{ d }}</option>
      </select>
    </div>

    <div v-if="loading" class="flex justify-center py-16 text-slate-400 font-bold text-sm">
      <span class="animate-spin mr-2">⏳</span> 載入評價庫中...
    </div>

    <div v-else-if="reviews.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
      <span class="text-5xl">📭</span>
      <p class="font-bold text-sm">找不到符合條件的課程評價</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="r in reviews" :key="r.id"
        class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-3">
        <div>
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <span class="text-[10px] font-black bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200">{{ r.dept }}</span>
              <h3 class="font-black text-slate-900 text-lg mt-1.5">{{ r.course_name }}</h3>
              <div class="text-xs text-slate-500 font-bold mt-0.5">{{ r.teacher }} ・ {{ r.semester }}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div :class="['text-lg tracking-tighter', ratingColor(r.rating)]">{{ renderStars(r.rating) }}</div>
            </div>
          </div>

          <div class="flex gap-2 mb-3">
            <span :class="['text-[11px] px-2.5 py-0.5 rounded-md', diffColor(r.difficulty)]">
              作業難度：{{ difficultyLabel[r.difficulty] || '普通' }}
            </span>
            <span class="text-[11px] px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-black border border-indigo-100">
              滿意度 {{ r.rating }}/5
            </span>
          </div>

          <p class="text-xs sm:text-sm text-slate-700 font-bold leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100/80">{{ r.content }}</p>
        </div>

        <div class="flex justify-between items-center text-[11px] font-mono text-slate-400 border-t border-slate-100 pt-3 font-bold">
          <span>✍️ {{ r.author || '匿名' }}</span>
          <span>📅 {{ r.created_at?.slice(0, 10) || '2025-08-10' }}</span>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showModal=false" />
          <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col">
            <div class="bg-slate-900 p-6 text-white flex items-center justify-between">
              <h3 class="text-base font-black flex items-center gap-2"><span>✏️</span> 撰寫修課避雷評價</h3>
              <button @click="showModal=false" class="text-slate-400 hover:text-white font-bold text-xl cursor-pointer">✕</button>
            </div>
            <div v-if="submitSuccess" class="m-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-3 text-xs font-black text-center animate-pulse">
              ✅ 評價送出成功，感謝你的無私貢獻！
            </div>
            <div v-if="submitError" class="mx-6 mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-bold">{{ submitError }}</div>
            
            <form @submit.prevent="submit" class="p-6 space-y-3.5 text-xs font-bold text-slate-700">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block mb-1">課程名稱 <span class="text-rose-500">*</span></label>
                  <input v-model="form.course_name" type="text" placeholder="例：微積分" :class="['w-full p-2.5 bg-slate-50 rounded-xl border', formErrors.course_name?'border-rose-400':'border-slate-300']" />
                  <p v-if="formErrors.course_name" class="text-rose-500 text-[10px] mt-1">{{ formErrors.course_name }}</p>
                </div>
                <div>
                  <label class="block mb-1">授課教師 <span class="text-rose-500">*</span></label>
                  <input v-model="form.teacher" type="text" placeholder="例：陳志明" :class="['w-full p-2.5 bg-slate-50 rounded-xl border', formErrors.teacher?'border-rose-400':'border-slate-300']" />
                  <p v-if="formErrors.teacher" class="text-rose-500 text-[10px] mt-1">{{ formErrors.teacher }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block mb-1">開課學院</label>
                  <select v-model="form.dept" class="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300">
                    <option v-for="d in depts.slice(1)" :key="d" :value="d">{{ d }}</option>
                  </select>
                </div>
                <div>
                  <label class="block mb-1">修課學期</label>
                  <select v-model="form.semester" class="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300">
                    <option v-for="s in ['113上','113下','112上','112下','111上','111下']" :key="s">{{ s }}</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label class="block mb-1">整體推薦度 (1~5)</label>
                  <div class="flex gap-1">
                    <button type="button" v-for="n in 5" :key="n" @click="form.rating=n" :class="['text-xl cursor-pointer', n<=form.rating?'text-amber-400':'text-slate-200']">★</button>
                  </div>
                </div>
                <div>
                  <label class="block mb-1">作業硬度 (1最簡~5地獄)</label>
                  <div class="flex gap-1">
                    <button type="button" v-for="n in 5" :key="n" @click="form.difficulty=n" :class="['text-xl cursor-pointer', n<=form.difficulty?'text-rose-500':'text-slate-200']">●</button>
                  </div>
                </div>
              </div>

              <div>
                <label class="block mb-1">真實評價內容 <span class="text-rose-500">*</span></label>
                <textarea v-model="form.content" rows="3" placeholder="分享給分標準、點名方式、考試難度..." :class="['w-full p-3 bg-slate-50 rounded-xl border resize-none font-normal', formErrors.content?'border-rose-400':'border-slate-300']"></textarea>
                <p v-if="formErrors.content" class="text-rose-500 text-[10px] mt-1">{{ formErrors.content }}</p>
              </div>

              <div>
                <label class="block mb-1">您的署名 (選填)</label>
                <input v-model="form.author" type="text" placeholder="例：資工三學長（留空則為匿名）" class="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-normal" />
              </div>

              <div class="flex gap-3 pt-2">
                <button type="button" @click="showModal=false" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition cursor-pointer">取消</button>
                <button type="submit" :disabled="submitting||submitSuccess" class="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow transition cursor-pointer">
                  {{ submitting ? '⏳ 傳送中...' : (submitSuccess ? '✅ 已送出' : '確認送出評價') }}
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
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>