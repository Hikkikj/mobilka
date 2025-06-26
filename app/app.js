import Vue from 'nativescript-vue';
import Home from './components/Home';

// Импорт официального RadSideDrawer плагина
import RadSideDrawerPlugin from 'nativescript-ui-sidedrawer/vue';

Vue.use(RadSideDrawerPlugin);

new Vue({
  render: (h) => h('frame', [h(Home)]),
}).$start();
