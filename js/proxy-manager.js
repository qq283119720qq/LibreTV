// CORS代理管理器

class ProxyManager {
    constructor() {
        this.config = CORS_PROXY_CONFIG;
        this.currentProxyIndex = 0;
        this.failedProxies = new Set();
        this.lastSuccessfulProxy = null;
    }

    /**
     * 获取当前应使用的代理URL
     */
    getCurrentProxyUrl() {
        // 如果禁用第三方代理，直接返回内置代理
        if (!this.config.useThirdPartyProxy) {
            return this.config.internalProxy;
        }

        // 如果有上次成功的代理且未失败，优先使用
        if (this.lastSuccessfulProxy && !this.failedProxies.has(this.lastSuccessfulProxy)) {
            return this.lastSuccessfulProxy;
        }

        // 查找下一个可用的第三方代理
        const availableProxies = this.config.thirdPartyProxies.filter(
            proxy => !this.failedProxies.has(proxy)
        );

        if (availableProxies.length > 0) {
            return availableProxies[this.currentProxyIndex % availableProxies.length];
        }

        // 如果所有第三方代理都失败，返回内置代理
        if (this.config.fallbackToInternal) {
            this.debugLog('所有第三方代理失败，降级到内置代理');
            return this.config.internalProxy;
        }

        // 重置失败记录，重新尝试
        this.failedProxies.clear();
        return this.config.thirdPartyProxies[0];
    }

    /**
     * 构建完整的代理请求URL
     */
    buildProxyUrl(targetUrl) {
        const proxyUrl = this.getCurrentProxyUrl();
        
        // 内置代理使用路径方式
        if (proxyUrl === this.config.internalProxy) {
            return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
        }
        
        // 第三方代理使用查询参数方式
        return `${proxyUrl}${encodeURIComponent(targetUrl)}`;
    }

    /**
     * 代理请求失败时调用
     */
    markProxyFailed(proxyUrl) {
        this.failedProxies.add(proxyUrl);
        this.debugLog(`代理失败: ${proxyUrl}`);
        
        // 如果失败的是当前成功的代理，清除记录
        if (this.lastSuccessfulProxy === proxyUrl) {
            this.lastSuccessfulProxy = null;
        }
        
        // 切换到下一个代理
        this.currentProxyIndex++;
    }

    /**
     * 代理请求成功时调用
     */
    markProxySuccess(proxyUrl) {
        this.lastSuccessfulProxy = proxyUrl;
        this.debugLog(`代理成功: ${proxyUrl}`);
    }

    /**
     * 智能代理请求，自动尝试多个代理源
     */
    async smartFetch(targetUrl, options = {}) {
        const maxRetries = this.config.thirdPartyProxies.length + (this.config.fallbackToInternal ? 1 : 0);
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const proxyUrl = this.getCurrentProxyUrl();
            const fullUrl = this.buildProxyUrl(targetUrl);
            
            try {
                this.debugLog(`尝试代理 ${attempt + 1}/${maxRetries}: ${proxyUrl}`);
                
                // 设置超时
                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(), 
                    this.config.thirdPartyTimeout
                );
                
                const response = await fetch(fullUrl, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (response.ok) {
                    this.markProxySuccess(proxyUrl);
                    return response;
                }
                
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                
            } catch (error) {
                this.debugLog(`代理请求失败: ${error.message}`);
                this.markProxyFailed(proxyUrl);
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === maxRetries - 1) {
                    throw new Error(`所有代理尝试失败，最后错误: ${error.message}`);
                }
            }
        }
    }

    /**
     * 重置代理状态
     */
    reset() {
        this.currentProxyIndex = 0;
        this.failedProxies.clear();
        this.lastSuccessfulProxy = null;
        this.debugLog('代理状态已重置');
    }

    /**
     * 调试日志
     */
    debugLog(message) {
        if (this.config.debugMode) {
            console.log(`[ProxyManager] ${message}`);
        }
    }
}

// 全局代理管理器实例
const proxyManager = new ProxyManager();

// 导出便捷函数
window.smartFetch = (url, options) => proxyManager.smartFetch(url, options);
window.buildProxyUrl = (url) => proxyManager.buildProxyUrl(url);
window.resetProxy = () => proxyManager.reset();
