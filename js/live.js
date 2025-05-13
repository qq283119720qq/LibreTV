// 全局变量
let allChannels = [];
let currentCategory = 'all';
let isLoading = true;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 监听搜索输入回车事件
    document.getElementById('channelSearchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchChannels();
        }
    });
    
    // 为分类标签添加点击事件
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            selectCategory(category);
        });
    });
    
    // 加载频道数据
    loadChannels();
});

// 加载频道数据
async function loadChannels() {
    try {
        isLoading = true;
        updateLoadingState();
        
        // 从JSON文件加载频道数据
        const response = await fetch('data/channels.json');
        if (!response.ok) {
            throw new Error('频道数据加载失败');
        }
        
        const data = await response.json();
        allChannels = data.channels || [];
        
        // 显示所有频道
        displayChannels(allChannels);
    } catch (error) {
        console.error('加载频道数据错误:', error);
        showToast('加载频道数据失败，请稍后重试', 'error');
    } finally {
        isLoading = false;
        updateLoadingState();
    }
}

// 更新加载状态
function updateLoadingState() {
    const loadingElement = document.getElementById('loadingChannels');
    const channelsListElement = document.getElementById('channelListContainer');
    const noResultsElement = document.getElementById('noResults');
    
    if (isLoading) {
        loadingElement.classList.remove('hidden');
        channelsListElement.classList.add('hidden');
        noResultsElement.classList.add('hidden');
    } else {
        loadingElement.classList.add('hidden');
        
        // 如果没有结果，显示无结果状态
        if (document.querySelectorAll('#channelsList .channel-card').length === 0) {
            channelsListElement.classList.add('hidden');
            noResultsElement.classList.remove('hidden');
        } else {
            channelsListElement.classList.remove('hidden');
            noResultsElement.classList.add('hidden');
        }
    }
}

// 显示频道列表
function displayChannels(channels) {
    const channelsListElement = document.getElementById('channelsList');
    channelsListElement.innerHTML = '';
    
    if (channels.length === 0) {
        updateLoadingState();
        return;
    }
    
    channels.forEach(channel => {
        const channelCard = document.createElement('div');
        channelCard.className = 'channel-card bg-[#111] rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] shadow-sm hover:shadow-lg';
        
        // 使用安全的URL构建
        const safeUrl = encodeURIComponent(channel.url);
        const safeName = channel.name.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        
        channelCard.innerHTML = `
            <div class="relative pb-[56.25%] bg-[#0a0a0a]">
                <img 
                    src="${channel.logo || './image/retrotv_5520.png'}" 
                    alt="${safeName}" 
                    class="absolute inset-0 w-full h-full object-contain p-2"
                    onerror="this.onerror=null; this.src='./image/retrotv_5520.png';">
            </div>
            <div class="p-3 flex flex-col">
                <h3 class="font-medium text-sm mb-1 truncate">${safeName}</h3>
                <div class="flex flex-wrap gap-1 mt-auto">
                    ${channel.categories.map(cat => 
                        `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">${getCategoryName(cat)}</span>`
                    ).join('')}
                </div>
            </div>
        `;
        
        // 添加点击事件以播放直播
        channelCard.addEventListener('click', function() {
            playLiveChannel(channel);
        });
        
        channelsListElement.appendChild(channelCard);
    });
    
    updateLoadingState();
}

// 获取类别的中文名称
function getCategoryName(category) {
    const categoryNames = {
        'news': '新闻资讯',
        'entertainment': '娱乐综艺',
        'documentary': '纪录片',
        'sports': '体育赛事',
        'international': '国际频道'
    };
    
    return categoryNames[category] || category;
}

// 搜索频道
function searchChannels() {
    const searchInput = document.getElementById('channelSearchInput');
    const query = searchInput.value.trim().toLowerCase();
    
    if (query === '') {
        // 如果搜索框为空，显示当前类别的所有频道
        filterChannelsByCategory(currentCategory);
        return;
    }
    
    // 搜索频道名称
    const filteredChannels = allChannels.filter(channel => {
        return channel.name.toLowerCase().includes(query) || 
               (channel.categories && channel.categories.some(cat => getCategoryName(cat).toLowerCase().includes(query)));
    });
    
    displayChannels(filteredChannels);
}

// 选择类别
function selectCategory(category) {
    // 更新UI
    document.querySelectorAll('.category-tab').forEach(tab => {
        if (tab.getAttribute('data-category') === category) {
            tab.classList.remove('bg-[#222]', 'hover:bg-[#333]');
            tab.classList.add('bg-pink-600');
        } else {
            tab.classList.remove('bg-pink-600');
            tab.classList.add('bg-[#222]', 'hover:bg-[#333]');
        }
    });
    
    // 更新当前类别并过滤频道
    currentCategory = category;
    filterChannelsByCategory(category);
    
    // 清空搜索框
    document.getElementById('channelSearchInput').value = '';
}

// 根据类别过滤频道
function filterChannelsByCategory(category) {
    if (category === 'all') {
        displayChannels(allChannels);
    } else {
        const filteredChannels = allChannels.filter(channel => 
            channel.categories && channel.categories.includes(category)
        );
        displayChannels(filteredChannels);
    }
}

// 播放直播频道
function playLiveChannel(channel) {
    // 密码保护校验
    if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
            showPasswordModal && showPasswordModal();
            return;
        }
    }
    
    try {
        // 构建视频信息对象
        const videoInfo = {
            title: channel.name,
            url: channel.url,
            episodeIndex: 0, // 直播没有集数概念，设为0
            sourceName: '直播频道',
            timestamp: Date.now(),
            isLive: true, // 标记为直播内容
            logo: channel.logo
        };
        
        // 保存到观看历史
        if (typeof addToViewingHistory === 'function') {
            addToViewingHistory(videoInfo);
        }
        
        // 构建播放页面URL
        const playerUrl = `player.html?url=${encodeURIComponent(channel.url)}&title=${encodeURIComponent(channel.name)}&isLive=true&logo=${encodeURIComponent(channel.logo || '')}`;
        
        // 跳转到播放页面
        window.location.href = playerUrl;
    } catch (error) {
        console.error('播放直播频道错误:', error);
        showToast('播放失败，请稍后重试', 'error');
    }
}

// 页面操作相关函数
function resetToHome() {
    // 重置为首页状态
    document.getElementById('channelSearchInput').value = '';
    selectCategory('all');
}
