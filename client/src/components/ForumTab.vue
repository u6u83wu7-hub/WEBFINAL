<script setup>
import { ref, onMounted } from 'vue'
const BASE_URL = ''

const posts         = ref([])
const loading       = ref(false)
const catFilter     = ref('all')
const activePost    = ref(null)
const comments      = ref([])
const commentLoading = ref(false)
const showNewPost   = ref(false)
const submitting    = ref(false)
const newComment    = ref('')
const commentAuthor = ref('')
const submitError   = ref(null)

// ⭐ 完美匹配後端 SQLite 資料庫寫入的 6 大真實版塊分類
const categories = ['全部', '轉學資訊', '選課討論', '生活資訊', '課業求救', '逢甲校園', '一般閒聊']
const catColors  = {
  '轉學資訊': 'bg-blue-100 text-blue-800 border-blue-200',
  '選課討論': 'bg-purple-100 text-purple-800 border-purple-200',
  '生活資訊': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  '課業求救': 'bg-rose-100 text-rose-800 border-rose-200',
  '逢甲校園': 'bg-amber-100 text-amber-800 border-amber-200',
  '一般閒聊': 'bg-slate-100 text-slate-700 border-slate-200',
}

const newPost    = ref({ category: '一般閒聊', title: '', content: '', author: '' })
const postErrors = ref({})

async function fetchPosts() {
  loading.value = true
  try {
    const p = new URLSearchParams()
    if (catFilter.value !== 'all') p.set('category', catFilter.value)
    const res  = await fetch(`${BASE_URL}/api/posts?${p.toString()}`)
    if (!res.ok) throw new Error('API Error')
    const data = await res.json()
    posts.value = data.posts || []
  } catch {
    posts.value = []
  } finally {
    loading.value = false
  }
}

async function openPost(post) {
  activePost.value = post
  commentLoading.value = true
  try {
    const res  = await fetch(`${BASE_URL}/api/posts/${post.id}/comments`)
    if (!res.ok) throw new Error('Comment API Error')
    const data = await res.json()
    comments.value = data.comments || []
  } catch {
    comments.value = []
  } finally {
    commentLoading.value = false
  }
}

function closePost() {
  activePost.value = null
  comments.value = []
  newComment.value = ''
  commentAuthor.value = ''
}

async function sendComment() {
  if (!newComment.value.trim()) return
  try {
    await fetch(`${BASE_URL}/api/posts/${activePost.value.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: newComment.value.trim(),
        author:  commentAuthor.value.trim() || '匿名島民',
      }),
    })
    newComment.value    = ''
    commentAuthor.value = ''
    const res  = await fetch(`${BASE_URL}/api/posts/${activePost.value.id}/comments`)
    const data = await res.json()
    comments.value = data.comments || []
  } catch (e) {
    submitError.value = e.message
  }
}

async function likePost(post) {
  try {
    await fetch(`${BASE_URL}/api/posts/${post.id}/like`, { method: 'POST' })
    post.likes = (post.likes || 0) + 1
  } catch (e) { console.error(e) }
}

function validatePost() {
  const e = {}
  if (!newPost.value.title.trim())   e.title   = '請填寫討論標題'
  if (!newPost.value.content.trim()) e.content = '請填寫討論具體內容'
  postErrors.value = e
  return Object.keys(e).length === 0
}

async function submitPost() {
  if (!validatePost()) return
  submitting.value  = true
  submitError.value = null
  try {
    const res  = await fetch(`${BASE_URL}/api/posts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        ...newPost.value,
        author: newPost.value.author.trim() || '匿名島民'
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '發文失敗')
    if (data.post) posts.value.unshift(data.post)
    showNewPost.value = false
    newPost.value = { category: '一般閒聊', title: '', content: '', author: '' }
    postErrors.value  = {}
  } catch (e) {
    submitError.value = e.message
  } finally {
    submitting.value = false
  }
}

onMounted(fetchPosts)
</script>

<template>
  <div class="space-y-6 text-slate-800 pb-12 font-sans">
    
    <div v-if="!activePost" class="space-y-6">
      
      <div class="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h2 class="text-2xl font-black text-slate-900 mb-1 flex items-center gap-2">
            <span>💬</span> 轉學生專屬情報交流棧
          </h2>
          <p class="text-xs font-bold text-slate-500">尋找直屬學長姐、二手書買賣、租屋避雷，隨時呼叫逢甲同路人。</p>
        </div>
        <button @click="showNewPost = true"
          class="flex items-center gap-1.5 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-2xl shadow transition cursor-pointer">
          <span>📢</span><span>發表新情報討論</span>
        </button>
      </div>

      <div class="flex gap-2 flex-wrap bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          v-for="cat in categories" :key="cat"
          @click="catFilter = cat === '全部' ? 'all' : cat; fetchPosts()"
          :class="[
            'px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer',
            (cat === '全部' && catFilter === 'all') || catFilter === cat
              ? 'bg-slate-900 text-white shadow'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ]">
          {{ cat }}
        </button>
      </div>

      <div v-if="loading" class="flex justify-center py-16 text-slate-400 font-bold text-sm">
        <span class="animate-spin mr-2">🔄</span> 讀取討論串中...
      </div>

      <div v-else-if="posts.length === 0" class="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
        <span class="text-5xl">📭</span>
        <p class="font-bold text-sm">這個板塊目前還沒有文章，搶先發第一篇吧！</p>
      </div>

      <div v-else class="space-y-3">
        <div v-for="post in posts" :key="post.id"
          class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition cursor-pointer space-y-3"
          @click="openPost(post)">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <span :class="['text-[11px] px-2.5 py-0.5 rounded-md font-black border', catColors[post.category] || 'bg-slate-100 text-slate-700 border-slate-200']">
                {{ post.category }}
              </span>
              <span class="text-xs text-slate-400 font-mono font-bold">{{ post.created_at?.slice(0, 10) || '2025-08-10' }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs font-bold text-slate-400">
              <button @click.stop="likePost(post)" class="hover:text-rose-500 transition flex items-center gap-1 bg-rose-50/60 px-2.5 py-1 rounded-lg border border-rose-100 text-rose-700">
                <span>❤️</span><span>{{ post.likes || 0 }}</span>
              </button>
              <span class="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-600">💬 回應</span>
            </div>
          </div>

          <h3 class="font-black text-slate-900 text-lg truncate">{{ post.title }}</h3>
          <p class="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed font-medium bg-slate-50 p-3 rounded-xl border border-slate-100/80">{{ post.content }}</p>

          <div class="text-[11px] text-slate-400 font-mono font-bold pt-1">
            <span>✍️ 發文者：{{ post.author || '匿名島民' }}</span>
          </div>
        </div>
      </div>

    </div>

    <div v-else class="space-y-4">
      <button @click="closePost" class="flex items-center gap-1.5 text-xs font-black bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition cursor-pointer shadow">
        <span>←</span><span>返回情報棧清單</span>
      </button>

      <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-4">
          <div class="flex items-center gap-2">
            <span :class="['text-xs px-3 py-1 rounded-lg font-black border', catColors[activePost.category] || 'bg-slate-100 text-slate-700 border-slate-200']">
              {{ activePost.category }}
            </span>
            <span class="text-xs text-slate-400 font-mono font-bold">{{ activePost.created_at?.slice(0, 10) || '2025-08-10' }}</span>
          </div>
          <button @click="likePost(activePost)" class="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-black transition cursor-pointer">
            <span>❤️</span><span>{{ activePost.likes || 0 }} 人覺得實用</span>
          </button>
        </div>

        <h2 class="text-xl sm:text-2xl font-black text-slate-900 leading-snug">{{ activePost.title }}</h2>
        <p class="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-bold bg-slate-50 p-4 rounded-2xl border border-slate-100">{{ activePost.content }}</p>
        
        <div class="text-xs text-slate-400 font-mono font-bold pt-2">
          <span>✍️ 情報提供者：{{ activePost.author || '匿名島民' }}</span>
        </div>
      </div>

      <div class="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
        <h3 class="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <span>💬</span><span>島民回應區 (共 {{ comments.length }} 則)</span>
        </h3>

        <div v-if="commentLoading" class="text-center py-8 text-slate-400 font-bold text-xs">
          <span class="animate-spin inline-block mr-2">🔄</span> 載入歷史回應中...
        </div>

        <div v-else class="space-y-3">
          <div v-if="comments.length === 0" class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-bold">
            目前尚未有島民給予回應，搶下頭香吧！
          </div>
          <div v-else class="space-y-3">
            <div v-for="c in comments" :key="c.id" class="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-teal-600 text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm font-mono">
                {{ (c.author || '島')[0] }}
              </div>
              <div class="flex-1 space-y-1">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-black text-slate-900">{{ c.author || '島民' }}</span>
                  <span class="text-[10px] text-slate-400 font-mono font-bold">{{ c.created_at?.slice(0, 10) || '' }}</span>
                </div>
                <p class="text-xs text-slate-700 font-bold leading-relaxed">{{ c.content }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
          <span class="block text-xs font-black text-slate-700">✍️ 留下你的友善協助或看法</span>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input v-model="commentAuthor" type="text" placeholder="您的暱稱 (留空則為匿名島民)"
              class="sm:col-span-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-600" />
            <input v-model="newComment" @keydown.enter="sendComment" type="text" placeholder="輸入回應內容，按 Enter 快速送出..."
              class="sm:col-span-2 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-600" />
          </div>
          <div class="flex justify-end pt-1">
            <button @click="sendComment" :disabled="!newComment.trim()"
              :class="[
                'px-6 py-2 rounded-xl text-xs font-black text-white shadow transition cursor-pointer',
                newComment.trim() ? 'bg-teal-600 hover:bg-teal-700' : 'bg-slate-300 cursor-not-allowed',
              ]">
              送出回應
            </button>
          </div>
        </div>
      </div>

    </div>

    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showNewPost" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" @click="showNewPost = false" />
          <div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 class="text-base font-black text-slate-900 flex items-center gap-1.5"><span>📢</span> 發表新情報與討論</h3>
              <button @click="showNewPost = false" class="text-slate-400 hover:text-slate-600 font-bold text-xl cursor-pointer">✕</button>
            </div>
            
            <div v-if="submitError" class="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs font-bold">{{ submitError }}</div>
            
            <form @submit.prevent="submitPost" class="space-y-3.5 text-xs font-bold text-slate-700">
              <div>
                <label class="block mb-1">情報歸類板塊</label>
                <div class="flex gap-1.5 flex-wrap">
                  <button type="button" v-for="cat in categories.slice(1)" :key="cat"
                    @click="newPost.category = cat"
                    :class="[
                      'px-3 py-1.5 rounded-xl text-xs font-black transition border cursor-pointer',
                      newPost.category === cat
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-400',
                    ]">
                    {{ cat }}
                  </button>
                </div>
              </div>

              <div>
                <label class="block mb-1">標題 <span class="text-rose-500">*</span></label>
                <input v-model="newPost.title" type="text" placeholder="一句話精簡說明你的疑問或情報" :class="['w-full p-2.5 bg-slate-50 rounded-xl border', postErrors.title?'border-rose-400':'border-slate-300']" />
                <p v-if="postErrors.title" class="text-rose-500 text-[10px] mt-1">{{ postErrors.title }}</p>
              </div>

              <div>
                <label class="block mb-1">具體內容說明 <span class="text-rose-500">*</span></label>
                <textarea v-model="newPost.content" rows="4" placeholder="詳細描述你想發問的課業、租屋地點或尋人物品..." :class="['w-full p-3 bg-slate-50 rounded-xl border resize-none font-normal', postErrors.content?'border-rose-400':'border-slate-300']"></textarea>
                <p v-if="postErrors.content" class="text-rose-500 text-[10px] mt-1">{{ postErrors.content }}</p>
              </div>

              <div>
                <label class="block mb-1">發文者暱稱 (選填)</label>
                <input v-model="newPost.author" type="text" placeholder="例如：企管二轉胞（留空則為匿名島民）" class="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-normal" />
              </div>

              <div class="flex gap-3 pt-2">
                <button type="button" @click="showNewPost = false" class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-xl transition cursor-pointer">取消</button>
                <button type="submit" :disabled="submitting" class="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-xl shadow transition cursor-pointer">
                  {{ submitting ? '⏳ 發布中...' : '確認發表文章' }}
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
/* 保留標準寫法消除波浪警告 */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>