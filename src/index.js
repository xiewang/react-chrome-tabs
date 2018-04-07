import React, {Component} from 'react';
import styles from './styles.css';
import _ from 'lodash';
import cs from 'classnames';
import Draggabilly from 'draggabilly';

let instanceId = 0;

const defaultTapProperties = {
    title: '',
    favicon: '',
    add: false
}

class Tabs extends Component {
    constructor() {
        super();
        this.state = {
            currentKey: 0
        };
        this.draggabillyInstances = []

    }

    componentDidMount() {
        const the = this;
        const el = document.querySelector('.' + styles.chrome_tabs);
        this.init(el, {
            tabOverlapDistance: 14,
            minWidth: 45,
            maxWidth: 243
        });

        document.addEventListener('mountTab', function (e) {
            the.state.add = true
        });
        document.addEventListener('switchPage', function (e) {
            const key = e.detail;
            const el = document.querySelectorAll('.' + styles.chrome_tab);

            _.each(el, (v)=>{
                const tabKey = v.getAttribute('tab-key');
                if(key.toString() === tabKey)
                    the.setCurrentTab(v);
            });
        });
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (!this.state.add) {
            return false;
        }
        this.state.add = false;
        this.state.path = nextProps.location.pathname;
        this._addNewTab({
            key: nextProps.tabs.tabs.length - 1,
            title: _.find(nextProps.tabs.tabs, (o)=>{return o.key == nextProps.tabs.tabs.length - 1}).name ,
            favicon: require('./default-favicon.png')
        });
        return true;
    }

    _addNewTab(tabProperties) {
        this.addTab(Object.assign({}, {
            title: 'New Tab',
            favicon: require('./default-favicon.png'),
        }, tabProperties));
    }

    init(el, options) {
        this.el = el
        this.options = options

        this.instanceId = instanceId
        this.el.setAttribute('data-chrome-tabs-instance-id', this.instanceId)
        instanceId += 1

        this.setupStyleEl()
        this.setupEvents()
        this.layoutTabs()
        this.fixZIndexes()
        this.setupDraggabilly()

        const tab = document.querySelector('.' + styles.chrome_tab);
        tab.setAttribute('tab-key', 0)
    }

    emit(eventName, data) {
        this.el.dispatchEvent(new CustomEvent(eventName, {detail: data}))
    }

    setupStyleEl() {
        this.animationStyleEl = document.createElement('style')
        this.el.appendChild(this.animationStyleEl)
    }

    setupEvents() {
        window.addEventListener('resize', event => this.layoutTabs())

        // this.el.addEventListener('dblclick', event => this.addTab())

        this.el.addEventListener('click', ({target}) => {
            if (target.classList.contains(styles.chrome_tab)) {
                this.setCurrentTab(target)
            } else if (target.classList.contains(styles.chrome_tab_close)) {
                this.removeTab(target.parentNode)
            } else if (target.classList.contains(styles.chrome_tab_title) || target.classList.contains(styles.chrome_tab_favicon)) {
                this.setCurrentTab(target.parentNode)
            }
        })
    }

    get tabEls() {
        return Array.prototype.slice.call(this.el.querySelectorAll('.' + styles.chrome_tab))
    }

    get tabContentEl() {
        return this.el.querySelector('.' + styles.chrome_tabs_content)
    }

    get tabWidth() {
        const tabsContentWidth = this.tabContentEl.clientWidth - this.options.tabOverlapDistance
        const width = (tabsContentWidth / this.tabEls.length) + this.options.tabOverlapDistance
        return Math.max(this.options.minWidth, Math.min(this.options.maxWidth, width))
    }

    get tabEffectiveWidth() {
        return this.tabWidth - this.options.tabOverlapDistance
    }

    get tabPositions() {
        const tabEffectiveWidth = this.tabEffectiveWidth
        let left = 0
        let positions = []

        this.tabEls.forEach((tabEl, i) => {
            positions.push(left)
            left += tabEffectiveWidth
        })
        return positions
    }

    layoutTabs() {
        const tabWidth = this.tabWidth

        this.cleanUpPreviouslyDraggedTabs()
        this.tabEls.forEach((tabEl) => tabEl.style.width = tabWidth + 'px')
        requestAnimationFrame(() => {
            let styleHTML = ''
            this.tabPositions.forEach((left, i) => {
                styleHTML += `
            .${styles.chrome_tabs}[data-chrome-tabs-instance-id="${ this.instanceId }"] .${styles.chrome_tab}:nth-child(${ i + 1 }) {
              transform: translate3d(${ left }px, 0, 0)
            }
          `
            })
            this.animationStyleEl.innerHTML = styleHTML
        })
    }

    fixZIndexes() {
        const bottomBarEl = this.el.querySelector('.' + styles.chrome_tabs_bottom_bar)
        const tabEls = this.tabEls

        tabEls.forEach((tabEl, i) => {
            let zIndex = tabEls.length - i

            if (tabEl.classList.contains(styles.chrome_tab_current)) {
                bottomBarEl.style.zIndex = tabEls.length + 1
                zIndex = tabEls.length + 2
            }
            tabEl.style.zIndex = zIndex
        })
    }

    createNewTabEl() {
        const div = document.createElement('div')
        div.innerHTML = document.querySelector('.' + styles.chrome_tab).outerHTML
        return div.firstElementChild
    }

    addTab(tabProperties) {
        const tabEl = this.createNewTabEl()

        tabEl.setAttribute('tab-key', tabProperties.key)
        this.setState({currentKey: tabProperties.key})
        tabEl.classList.add(styles.chrome_tab_just_added)
        setTimeout(() => tabEl.classList.remove(styles.chrome_tab_just_added), 500)

        tabProperties = Object.assign({}, defaultTapProperties, tabProperties)
        this.tabContentEl.appendChild(tabEl)
        this.updateTab(tabEl, tabProperties)
        this.emit('tabAdd', {tabEl})
        this.setCurrentTab(tabEl)
        this.layoutTabs()
        this.fixZIndexes()
        this.setupDraggabilly()
    }

    setCurrentTab(tabEl) {
        const currentTab = this.el.querySelector('.' + styles.chrome_tab_current)
        if (currentTab) currentTab.classList.remove(styles.chrome_tab_current)
        tabEl.classList.add(styles.chrome_tab_current)
        this.fixZIndexes()
        this.emit('activeTabChange', {tabEl})

        const {dispatch} = this.props;
        const tab = {
            key: tabEl.getAttribute('tab-key'),
            current: true,
        };
        dispatch(updateTabs(tab));
        document.dispatchEvent(new CustomEvent('switchTab', {detail: tab.key}));
    }

    removeTab(tabEl) {
        if (tabEl.classList.contains(styles.chrome_tab_current)) {
            if (tabEl.previousElementSibling) {
                this.setCurrentTab(tabEl.previousElementSibling)
            } else if (tabEl.nextElementSibling) {
                this.setCurrentTab(tabEl.nextElementSibling)
            }
        }
        tabEl.parentNode.removeChild(tabEl)
        this.emit('tabRemove', {tabEl})
        this.layoutTabs()
        this.fixZIndexes()
        this.setupDraggabilly()

        const {dispatch} = this.props;
        const tab = {
            key: tabEl.getAttribute('tab-key'),
        };
        dispatch(deleteTab(tab));

    }

    updateTab(tabEl, tabProperties) {
        tabEl.querySelector('.' + styles.chrome_tab_title).textContent = tabProperties.title
        tabEl.querySelector('.' + styles.chrome_tab_favicon).style.backgroundImage = `url('${tabProperties.favicon}')`
    }

    cleanUpPreviouslyDraggedTabs() {
        this.tabEls.forEach((tabEl) => tabEl.classList.remove(styles.chrome_tab_just_dragged))
    }

    setupDraggabilly() {
        const tabEls = this.tabEls
        const tabEffectiveWidth = this.tabEffectiveWidth
        const tabPositions = this.tabPositions

        this.draggabillyInstances.forEach(draggabillyInstance => draggabillyInstance.destroy())

        tabEls.forEach((tabEl, originalIndex) => {
            const originalTabPositionX = tabPositions[originalIndex]
            const draggabillyInstance = new Draggabilly(tabEl, {
                axis: 'x',
                containment: this.tabContentEl
            })

            this.draggabillyInstances.push(draggabillyInstance)

            draggabillyInstance.on('dragStart', () => {
                this.cleanUpPreviouslyDraggedTabs()
                tabEl.classList.add(styles.chrome_tab_currently_dragged)
                this.el.classList.add(styles.chrome_tabs_sorting)
                this.fixZIndexes()
            })

            draggabillyInstance.on('dragEnd', () => {
                const finalTranslateX = parseFloat(tabEl.style.left, 10)
                tabEl.style.transform = `translate3d(0, 0, 0)`

                // Animate dragged tab back into its place
                requestAnimationFrame(() => {
                    tabEl.style.left = '0'
                    tabEl.style.transform = `translate3d(${ finalTranslateX }px, 0, 0)`

                    requestAnimationFrame(() => {
                        tabEl.classList.remove(styles.chrome_tab_currently_dragged)
                        this.el.classList.remove(styles.chrome_tabs_sorting)

                        this.setCurrentTab(tabEl)
                        tabEl.classList.add(styles.chrome_tab_just_dragged)

                        requestAnimationFrame(() => {
                            tabEl.style.transform = ''

                            this.setupDraggabilly()
                        })
                    })
                })
            })

            draggabillyInstance.on('dragMove', (event, pointer, moveVector) => {
                // Current index be computed within the event since it can change during the dragMove
                const tabEls = this.tabEls
                const currentIndex = tabEls.indexOf(tabEl)

                const currentTabPositionX = originalTabPositionX + moveVector.x
                const destinationIndex = Math.max(0, Math.min(tabEls.length, Math.floor((currentTabPositionX + (tabEffectiveWidth / 2)) / tabEffectiveWidth)))

                if (currentIndex !== destinationIndex) {
                    this.animateTabMove(tabEl, currentIndex, destinationIndex)
                }
            })
        })
    }

    animateTabMove(tabEl, originIndex, destinationIndex) {
        if (destinationIndex < originIndex) {
            tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex])
        } else {
            tabEl.parentNode.insertBefore(tabEl, this.tabEls[destinationIndex + 1])
        }
    }

    render() {

        return (
            <div className={cs(styles.chrome_tabs, styles.chrome_tabs_dark_theme)}>
                <div className={styles.chrome_tabs_content}>
                    <div className={cs(styles.chrome_tab, styles.chrome_tab_current)}>
                        <div className={styles.chrome_tab_background}>
                            <svg version="1.1" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <symbol id="topleft" viewBox="0 0 214 29">
                                        <path
                                            d="M14.3 0.1L214 0.1 214 29 0 29C0 29 12.2 2.6 13.2 1.1 14.3-0.4 14.3 0.1 14.3 0.1Z"/>
                                    </symbol>
                                    <symbol id="topright" viewBox="0 0 214 29">
                                        <use xlinkHref="#topleft"/>
                                    </symbol>
                                    <clipPath id="crop">
                                        <rect className={styles.mask} width="100%" height="100%" x="0"/>
                                    </clipPath>
                                </defs>
                                <svg width="50%" height="100%" transfrom="scale(-1, 1)">
                                    <use xlinkHref="#topleft" width="214" height="29"
                                         className={styles.chrome_tab_background}/>
                                    <use xlinkHref="#topleft" width="214" height="29"
                                         className={styles.chrome_tab_shadow}/>
                                </svg>
                                <g transform="scale(-1, 1)">
                                    <svg width="50%" height="100%" x="-100%" y="0">
                                        <use xlinkHref="#topright" width="214" height="29"
                                             className={styles.chrome_tab_background}/>
                                        <use xlinkHref="#topright" width="214" height="29"
                                             className={styles.chrome_tab_shadow}/>
                                    </svg>
                                </g>
                            </svg>
                        </div>
                        <div className={styles.chrome_tab_favicon}
                             style={{backgroundImage: "url(" + require('./default-favicon.png') + ")"}}></div>
                        <div className={styles.chrome_tab_title}>Home</div>
                        <div className={styles.chrome_tab_close}></div>
                    </div>
                </div>
                <div className={styles.chrome_tabs_bottom_bar}></div>
            </div>
        )
    }

}


export default Tabs;