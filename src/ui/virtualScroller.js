// ============================================
// 가상 스크롤러 - 대량 캐릭터 최적화
// Intersection Observer + 청크 렌더링 방식
// ============================================

/**
 * 가상 스크롤러 클래스
 * 화면에 보이는 아이템만 렌더링하여 DOM 노드 수 대폭 감소
 */
export class VirtualScroller {
    constructor(options) {
        this.container = options.container;
        this.items = options.items || [];
        this.renderItem = options.renderItem;
        this.itemHeight = options.itemHeight || 180;
        this.itemWidth = options.itemWidth || 140;
        this.gap = options.gap || 12;
        this.bufferSize = options.bufferSize || 2;
        this.onRenderComplete = options.onRenderComplete || null;

        // 상태
        this.startIndex = 0;
        this.columns = 1;
        this.isDestroyed = false;

        // DOM 요소
        this.wrapper = null;
        this.content = null;
        this.topSentinel = null;
        this.bottomSentinel = null;

        // Observers
        this.intersectionObserver = null;
        this.resizeObserver = null;
        this._scrollContainer = null;
        this._renderTimeout = null;

        this.init();
    }

    init() {
        if (!this.container) {
            console.error('[VirtualScroller] Container not found');
            return;
        }
        this.calculateColumns();
        this.createStructure();
        this.setupObserver();
        this.render();
        this.setupResizeObserver();
        console.log('[VirtualScroller] Initialized with', this.items.length, 'items,', this.columns, 'columns');
    }

    calculateColumns() {
        const containerWidth = this.container.clientWidth || 300;
        this.columns = Math.max(1, Math.floor((containerWidth + this.gap) / (this.itemWidth + this.gap)));
    }

    createStructure() {
        this.container.innerHTML = '';
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'virtual-scroll-wrapper';

        this.topSentinel = document.createElement('div');
        this.topSentinel.className = 'virtual-sentinel virtual-sentinel-top';

        this.content = document.createElement('div');
        this.content.className = 'virtual-scroll-content lobby-char-grid';

        this.bottomSentinel = document.createElement('div');
        this.bottomSentinel.className = 'virtual-sentinel virtual-sentinel-bottom';

        this.wrapper.appendChild(this.topSentinel);
        this.wrapper.appendChild(this.content);
        this.wrapper.appendChild(this.bottomSentinel);
        this.container.appendChild(this.wrapper);
    }

    setupObserver() {
        const scrollContainer = this.findScrollContainer();
        this._scrollContainer = scrollContainer;
        
        // 스크롤 이벤트로 직접 처리 (Intersection Observer 대신 더 안정적)
        if (scrollContainer) {
            this._onScroll = this._handleScroll.bind(this);
            scrollContainer.addEventListener('scroll', this._onScroll, { passive: true });
        }
    }
    
    _handleScroll() {
        if (this.isDestroyed || !this._scrollContainer) return;
        
        // 디바운스
        if (this._scrollTimeout) return;
        this._scrollTimeout = requestAnimationFrame(() => {
            this._scrollTimeout = null;
            this._updateVisibleRange();
        });
    }
    
    _updateVisibleRange() {
        if (this.isDestroyed || !this._scrollContainer || this.items.length === 0) return;
        
        const scrollTop = this._scrollContainer.scrollTop;
        const containerHeight = this._scrollContainer.clientHeight || 600;
        
        // 현재 스크롤 위치에서 보여야 할 첫 번째 row 계산
        const firstVisibleRow = Math.floor(scrollTop / this.itemHeight);
        const newStartRow = Math.max(0, firstVisibleRow - this.bufferSize);
        const newStartIndex = newStartRow * this.columns;
        
        // startIndex가 변경되었을 때만 렌더링
        if (newStartIndex !== this.startIndex) {
            console.log('[VirtualScroller] _updateVisibleRange: scrollTop=', scrollTop, 
                        'firstRow=', firstVisibleRow, 'newStartIndex=', newStartIndex);
            this.startIndex = newStartIndex;
            this.render();
        }
    }

    setupResizeObserver() {
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isDestroyed) return;
            if (this._renderTimeout) clearTimeout(this._renderTimeout);
            this._renderTimeout = setTimeout(() => {
                const oldColumns = this.columns;
                this.calculateColumns();
                if (oldColumns !== this.columns) this.render();
            }, 100);
        });
        this.resizeObserver.observe(this.container);
    }

    findScrollContainer() {
        if (this._scrollContainer) return this._scrollContainer;
        let el = this.container.parentElement;
        while (el) {
            const style = getComputedStyle(el);
            if (style.overflow === 'auto' || style.overflowY === 'auto' ||
                style.overflow === 'scroll' || style.overflowY === 'scroll') {
                this._scrollContainer = el;
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    render() {
        if (this.isDestroyed || !this.content) return;

        if (this.items.length === 0) {
            this.content.innerHTML = '<div class="lobby-empty-state"><i></i><div>검색 결과가 없습니다</div></div>';
            this.wrapper.style.paddingBottom = '0px';
            this.content.style.marginTop = '0px';
            return;
        }

        const containerHeight = this.container.clientHeight || 600;
        const visibleRows = Math.ceil(containerHeight / this.itemHeight) + this.bufferSize * 2;
        const visibleItems = visibleRows * this.columns;
        const totalRows = Math.ceil(this.items.length / this.columns);
        const totalHeight = totalRows * this.itemHeight;

        const endIndex = Math.min(this.startIndex + visibleItems, this.items.length);
        const itemsToRender = this.items.slice(this.startIndex, endIndex);

        const html = itemsToRender.map((item, i) => this.renderItem(item, this.startIndex + i)).join('');
        this.content.innerHTML = html;

        const startRow = Math.floor(this.startIndex / this.columns);
        const topPadding = startRow * this.itemHeight;
        const renderedHeight = Math.ceil(itemsToRender.length / this.columns) * this.itemHeight;
        const bottomPadding = Math.max(0, totalHeight - topPadding - renderedHeight);

        this.content.style.marginTop = topPadding + 'px';
        this.wrapper.style.paddingBottom = bottomPadding + 'px';

        if (this.onRenderComplete) this.onRenderComplete();
        console.log('[VirtualScroller] Rendered items', this.startIndex, '-', endIndex, 'of', this.items.length);
    }

    loadNext() {
        if (this.isDestroyed) return;
        
        // 현재 보이는 아이템 수 계산
        const containerHeight = this.container.clientHeight || 600;
        const visibleRows = Math.ceil(containerHeight / this.itemHeight) + this.bufferSize * 2;
        const visibleItems = visibleRows * this.columns;
        
        // 마지막까지 렌더링 되었는지 확인
        const endIndex = this.startIndex + visibleItems;
        if (endIndex >= this.items.length) return;
        
        // 한 줄씩 아래로
        this.startIndex = this.startIndex + this.columns;
        console.log('[VirtualScroller] loadNext: startIndex =', this.startIndex);
        this.render();
    }

    loadPrevious() {
        if (this.isDestroyed) return;
        if (this.startIndex <= 0) {
            // 이미 맨 위인데 render가 안됐을 수 있으니 강제 렌더
            console.log('[VirtualScroller] loadPrevious: already at top, force render');
            this.render();
            return;
        }
        this.startIndex = Math.max(0, this.startIndex - this.columns);
        console.log('[VirtualScroller] loadPrevious: startIndex =', this.startIndex);
        this.render();
    }

    updateItems(newItems) {
        this.items = newItems || [];
        this.startIndex = 0;
        this.render();
    }

    scrollToIndex(index) {
        const row = Math.floor(index / this.columns);
        this.startIndex = Math.max(0, (row - this.bufferSize) * this.columns);
        this.render();
        const scrollContainer = this.findScrollContainer();
        if (scrollContainer) scrollContainer.scrollTop = row * this.itemHeight;
    }

    scrollToTop() {
        this.startIndex = 0;
        this.render();
        const scrollContainer = this.findScrollContainer();
        if (scrollContainer) scrollContainer.scrollTop = 0;
    }

    destroy() {
        this.isDestroyed = true;
        if (this._renderTimeout) clearTimeout(this._renderTimeout);
        if (this._scrollTimeout) cancelAnimationFrame(this._scrollTimeout);
        if (this._scrollContainer && this._onScroll) {
            this._scrollContainer.removeEventListener('scroll', this._onScroll);
        }
        this.resizeObserver?.disconnect();
        if (this.container) this.container.innerHTML = '';
        this._scrollContainer = null;
        console.log('[VirtualScroller] Destroyed');
    }
}