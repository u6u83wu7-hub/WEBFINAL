<script setup>
defineProps({
  tabs: {
    type: Array,
    required: true,
  },
  activeTab: {
    type: String,
    required: true,
  },
})

defineEmits(['change-tab'])
</script>

<template>
  <!-- ⭐ 1. 背景徹底血洗成深邃曜石黑 (bg-slate-900)，文字改為純白 (text-white) -->
  <header class="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xl transition-all duration-200">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      
      <!-- 【左側：滿血復活的熱帶島嶼與立體招牌】 -->
      <div 
        @click="$emit('change-tab', 'checklist')"
        class="flex items-center gap-3 cursor-pointer group select-none"
      >
        <!-- ⭐ 2. 修正亂碼：絕美的熱帶島嶼 -->
        <span class="text-2xl sm:text-3xl inline-block transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110">
          🏝️
        </span>
        
        <div class="flex items-baseline gap-2">
          <!-- 曜石黑底配純白黑體，招牌極度清晰 -->
          <h1 class="text-lg sm:text-xl font-black tracking-tight text-white group-hover:text-teal-400 transition-colors">
            UniTransfer Hub
          </h1>
          <span class="hidden sm:inline-block text-xs font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full tracking-wider">
            轉轉銜接島
          </span>
        </div>
      </div>

      <!-- 【右側：全站功能分頁按鈕列】 -->
      <nav class="flex items-center gap-1 sm:gap-2">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="$emit('change-tab', tab.key)"
          :title="tab.label"
          :class="[
            'px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer',
            activeTab === tab.key
              ? 'bg-teal-600 text-white shadow-md shadow-teal-900/50 scale-105'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60',
          ]"
        >
          <span class="text-base sm:text-lg leading-none">{{ tab.icon }}</span>
          <span class="hidden md:inline">{{ tab.label }}</span>
        </button>
      </nav>

    </div>
  </header>
</template>