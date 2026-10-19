-- Chat nội bộ: hội thoại, thành viên, tin nhắn, reaction, trạng thái gõ phím.
CREATE TABLE IF NOT EXISTS chat_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NULL,
  isGroup TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS chat_participants (
  conversationId INT NOT NULL,
  userId INT NOT NULL,
  lastReadMessageId INT NOT NULL DEFAULT 0,
  PRIMARY KEY (conversationId, userId),
  FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversationId INT NOT NULL,
  senderId INT NOT NULL,
  body TEXT NOT NULL,
  replyToId INT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX chat_messages_conversation_idx (conversationId, id),
  FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (replyToId) REFERENCES chat_messages(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS chat_reactions (
  messageId INT NOT NULL,
  userId INT NOT NULL,
  emoji VARCHAR(16) NOT NULL,
  PRIMARY KEY (messageId, userId, emoji),
  FOREIGN KEY (messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_typing (
  conversationId INT NOT NULL,
  userId INT NOT NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (conversationId, userId),
  FOREIGN KEY (conversationId) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
