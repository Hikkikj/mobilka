<template>
  <Page class="page">
    <ActionBar class="action-bar" title="GPT Chat">
      <NavigationButton
        icon="res://menu"
        android.systemIcon="ic_menu"
        @tap="toggleDrawer"
      />
    </ActionBar>

    <RadSideDrawer ref="drawer">
      <!-- MAIN CONTENT -->
      <GridLayout id="mainContent" ~mainContent rows="auto, *, auto" class="main-content">
        <!-- Header -->
        <StackLayout row="0" v-if="currentChat" class="chat-header">
          <Label :text="currentChat.title" class="chat-title" />
        </StackLayout>

        <!-- Messages -->
        <ScrollView ref="scrollView" row="1" class="messages">
          <StackLayout>
            <StackLayout v-if="currentChat">
              <!-- Сообщения в порядке добавления -->
              <StackLayout
                v-for="(msg, idx) in currentChat.messages"
                :key="idx"
                class="message"
                :class="msg.role"
                @longPress="onLongPress(idx)"
              >
                <Label :text="msg.content" textWrap="true" class="message-text" />
              </StackLayout>
            </StackLayout>
            <StackLayout v-else class="no-chat">
              <Label text="Выберите или создайте чат" class="no-chat-text" />
            </StackLayout>
          </StackLayout>
        </ScrollView>

        <!-- Input Bar -->
        <FlexboxLayout
          row="2"
          flexDirection="row"
          alignItems="center"
          v-if="currentChat"
          class="input-bar"
        >
          <TextField
            v-model="input"
            hint="Введите сообщение..."
            class="input"
            @returnPress="send"
          />
          <Button text="→" @tap="send" class="btn-send" />
        </FlexboxLayout>
      </GridLayout>

      <!-- DRAWER CONTENT -->
      <StackLayout ~drawerContent class="drawer-content">
        <Button text="+ Новый чат" @tap="newChat" class="btn-new-chat" />
        <ListView :items="chats" @itemTap="onChatTap" class="chat-list">
          <v-template>
            <Label :text="item.title" class="drawer-item" />
          </v-template>
        </ListView>
      </StackLayout>
    </RadSideDrawer>
  </Page>
</template>

<script>
import { ApplicationSettings, Clipboard } from '@nativescript/core';
import AbortController from 'abort-controller';
global.AbortController = AbortController;
import { OpenAI } from 'openai';

export default {
  name: 'Home',
  data() {
    return {
      GITHUB_TOKEN: '',
      STORAGE_KEY: 'GPT_CHAT_LIST',
      chats: [],
      currentChatId: null,
      input: '',
    };
  },
  computed: {
    client() {
      return new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: this.GITHUB_TOKEN,
      });
    },
    currentChat() {
      return this.chats.find(c => c.id === this.currentChatId) || null;
    }
  },
  mounted() {
    const saved = ApplicationSettings.getString(this.STORAGE_KEY);
    this.chats = saved ? JSON.parse(saved) : [];
    if (this.chats.length) {
      this.currentChatId = this.chats[0].id;
      this.$nextTick(this.scrollToBottom);
    }
  },
  methods: {
    toggleDrawer() {
      this.$refs.drawer.nativeView.toggleDrawerState();
    },
    saveChats() {
      ApplicationSettings.setString(this.STORAGE_KEY, JSON.stringify(this.chats));
    },
    newChat() {
      const id = Date.now().toString();
      // Изначальный временный заголовок; заменится после первого сообщения
      this.chats.unshift({ id, title: 'Новый чат', messages: [] });
      this.currentChatId = id;
      this.saveChats();
      this.$refs.drawer.nativeView.closeDrawer();
      this.$nextTick(this.scrollToBottom);
    },
    onChatTap(args) {
      const chat = this.chats[args.index];
      if (chat && chat.id) {
        this.currentChatId = chat.id;
        this.$refs.drawer.nativeView.closeDrawer();
        this.$nextTick(this.scrollToBottom);
      }
    },
    async send() {
      if (!this.currentChat || !this.input.trim()) return;
      const prompt = this.input.trim();

      // Если это первое сообщение в новом чате, обновляем заголовок
      if (this.currentChat.messages.length === 0) {
        const firstWord = prompt.split(/\s+/)[0];
        // Изменяем title на первое слово (можно до первой точки или запятой по желанию)
        this.currentChat.title = firstWord;
      }

      // Добавляем сообщение пользователя
      this.currentChat.messages.push({ role: 'user', content: prompt });

      // Контекст: последние 3 пользовательских
      const last = this.currentChat.messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => ({ role: 'user', content: m.content }));
      const messages = [{ role: 'system', content: '' }, ...last];

      this.input = '';
      this.saveChats();
      this.$nextTick(this.scrollToBottom);

      try {
        const res = await this.client.chat.completions.create({
          model: 'gpt-4o',
          messages,
          temperature: 1,
          max_tokens: 4096,
          top_p: 1,
        });
        const reply = res.choices[0].message.content;
        this.currentChat.messages.push({ role: 'assistant', content: reply });
        this.saveChats();
        this.$nextTick(this.scrollToBottom);
      } catch (e) {
        console.error('Ошибка API:', e);
        this.currentChat.messages.push({ role: 'assistant', content: 'Ошибка API' });
        this.saveChats();
        this.$nextTick(this.scrollToBottom);
      }
    },
    scrollToBottom() {
      try {
        const sv = this.$refs.scrollView.nativeView;
        sv.scrollToVerticalOffset(sv.scrollableHeight, false);
      } catch (e) {
        setTimeout(() => {
          try {
            const sv2 = this.$refs.scrollView.nativeView;
            sv2.scrollToVerticalOffset(sv2.scrollableHeight, false);
          } catch (_) {}
        }, 50);
      }
    },
    onLongPress(idx) {
      const msg = this.currentChat && this.currentChat.messages[idx];
      if (msg && msg.content) {
        Clipboard.setText(msg.content);
      }
    },
  }
};
</script>

<style scoped>
.page { background-color: #121212; }
.action-bar { background-color: #1e1e1e; color: #e0e0e0; }

.main-content { background-color: #121212; }

.chat-header {
  padding: 12 16;
  background-color: #1e1e1e;
}
.chat-title { color: #e0e0e0; font-size: 20; }

.messages {
  padding-top: 8;
  padding-bottom: 8;
  padding-left: 8;
  padding-right: 8;
}
.message {
  margin-vertical: 4;
  padding: 8 12;
  border-radius: 12;
  max-width: 80%;
}
.message.user {
  align-self: flex-end;
  margin: 4 16 4 40;
  background-color: #2962ff;
}
.message.assistant {
  align-self: flex-start;
  margin: 4 40 4 16;
  background-color: #333;
}
.message-text {
  color: #e0e0e0;
  font-size: 14;
  line-height: 20;
}

.input-bar {
  padding: 8 16;
  background-color: #1e1e1e;
  elevation: 0;
  box-shadow: none;
}
.input {
  flex-grow: 1;
  background-color: #2a2a2a;
  color: #e0e0e0;
  padding: 10 14;
  border-radius: 20;
  margin-right: 8;
  font-size: 14;
  box-shadow: none;
  elevation: 0;


}
.btn-send {
  width: 44;
  height: 44;
  border-radius: 22;
  background-color: #03dac6;
  color: #121212;
  font-size: 20;
  text-align: center;
}

.drawer-content { background-color: #1e1e1e; padding: 16; }
.btn-new-chat {
  background-color: #03dac6;
  color: #121212;
  padding: 12;
  border-radius: 8;
  margin-bottom: 16;
}
.chat-list { margin-top: 8; }
.drawer-item {
  padding: 10;
  color: #e0e0e0;
  border-bottom-width: 1;
  border-bottom-color: rgba(255,255,255,0.1);
}

.no-chat {
  height: 100%;
  justify-content: center;
}
.no-chat-text {
  color: #888;
  text-align: center;
}
</style>
