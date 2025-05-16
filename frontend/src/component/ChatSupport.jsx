'use client'

import { useState, useRef, useEffect } from 'react';
import styles from '../styles/ChatSupport.module.css';

const ChatSupport = () => {  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('ai'); // 'customer_service' or 'ai'
  const [walletModeEnabled, setWalletModeEnabled] = useState(false); // Toggle for Wallet mode
  const [userId, setUserId] = useState(''); // Generate unique ID for each session
  const [uploadedDocs, setUploadedDocs] = useState(null); // Store uploaded documents
    // Generate unique ID
  const generateUniqueId = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) + 
           '_' + Date.now().toString(36);
  };

  // Initialize user ID
  useEffect(() => {
    if (!userId) {
      setUserId(generateUniqueId());
    }
  }, []);
  // Dialog-related states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // File upload dialog
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Handle system message
  const handleSystemMessage = (text) => {
    const systemMessage = { 
      id: generateUniqueId(), 
      text: text, 
      isSystem: true,
      isAI: false
    };
    setMessages(prev => [...prev, systemMessage]);
  };
  const [messages, setMessages] = useState([
    { id: 'initial_msg_1', text: 'Hello! I am the SeaWallet AI assistant. How can I help you today?', isAI: true }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTypingEffect, setIsTypingEffect] = useState(true);  const [quickReplies, setQuickReplies] = useState([
    'How to deposit?',
    'Forgot password',
    'Fees and charges',
    'Contact support'
  ]);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chatBoxRef = useRef(null);
  const dialogRef = useRef(null);
  const fileDialogRef = useRef(null);
  // Initialize
  useEffect(() => {
    // Check user's preferred theme mode
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDarkMode);
    
    // Add animation end listener
    const handleAnimationEnd = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };
    
    document.addEventListener('animationend', handleAnimationEnd);
    
    // Close dialog when clicking outside chat box
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        setDialogOpen(false);
      }
      if (fileDialogRef.current && !fileDialogRef.current.contains(event.target)) {
        setFileDialogOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('animationend', handleAnimationEnd);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // Open message dialog
  const openMessageDialog = (message) => {
    if (message.isSystem) return; // System messages don't show dialog
    setSelectedMessage(message);
    setDialogOpen(true);
  };

  // Close message dialog
  const closeMessageDialog = () => {
    setDialogOpen(false);
  };

  // Open file upload dialog
  const openFileDialog = () => {
    setFileDialogOpen(true);
  };

  // Close file upload dialog
  const closeFileDialog = () => {
    setFileDialogOpen(false);
  };
  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedDocs(event.target.result);
      handleSystemMessage(`文件已上傳：${file.name}（此文件將直接用於問答上下文，而不會儲存在資料庫中）`);
      closeFileDialog();
    };
    reader.readAsText(file);
  };

  // Copy message text
  const copyMessageText = () => {
    if (selectedMessage) {
      navigator.clipboard.writeText(selectedMessage.text)
        .then(() => {
          handleSystemMessage('Message copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy message:', err);
          handleSystemMessage('Failed to copy message. Please try again.');
        });
    }
    closeMessageDialog();
  };
  // Mark message as important
  const markAsImportant = () => {
    if (selectedMessage) {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === selectedMessage.id 
            ? { ...msg, isImportant: !msg.isImportant } 
            : msg
        )
      );
      
      const actionText = selectedMessage.isImportant 
        ? 'Unmarked as important' 
        : 'Marked as important';
      
      handleSystemMessage(actionText);
    }
    closeMessageDialog();
  };

  // Delete message
  const deleteMessage = () => {
    if (selectedMessage) {
      setMessages(prev => prev.filter(msg => msg.id !== selectedMessage.id));
      handleSystemMessage('Message deleted');
    }
    closeMessageDialog();
  };

  // Toggle chat display/hide
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  // Toggle Wallet mode
  const toggleWalletMode = () => {
    setWalletModeEnabled(!walletModeEnabled);
    handleSystemMessage(`Wallet mode ${!walletModeEnabled ? 'enabled' : 'disabled'}`);
  };
  // Get the effective mode in use
  const getEffectiveMode = () => {
    if (mode === 'customer_service') {
      return 'customer_service';
    } else if (mode === 'ai' && walletModeEnabled) {
      return 'wallet';
    } else {
      return 'ai';
    }
  };

  // Handle streaming response
  const handleStreamResponse = async (message, currentMode) => {
    // 顯示加載狀態
    setIsLoading(true);
    const loadingMsgId = generateUniqueId();
    
    // 初始化一個空的回應訊息
    setMessages(prev => [...prev, { 
      id: loadingMsgId, 
      text: '', 
      isAI: true,
      isStreaming: true
    }]);
    
    try {
      // 準備請求數據
      const requestData = {
        message,
        mode: currentMode
      };
      
      // 如果是錢包模式，添加用戶ID和文檔
      if (currentMode === 'wallet') {
        requestData.userId = userId;
        requestData.docs = uploadedDocs;
      }
      
      // 使用 fetch 進行流式請求
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 取得讀取器
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      
      // 持續讀取流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解碼當前的數據塊
        const chunk = decoder.decode(value, { stream: true });
        // 處理 SSE 格式的數據
        const lines = chunk.split('\n\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(line.substring(6));
              
              if (eventData.type === 'text') {
                // 將新文字添加到累積的文字中
                accumulatedText += eventData.content;
                
                // 更新訊息，保留流式狀態
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === loadingMsgId 
                      ? { id: loadingMsgId, text: accumulatedText, isAI: true, isStreaming: isTypingEffect } 
                      : msg
                  )
                );
              } else if (eventData.type === 'done') {
                // 流式結束，更新訊息移除流式狀態
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === loadingMsgId 
                      ? { id: loadingMsgId, text: accumulatedText, isAI: true, isStreaming: false } 
                      : msg
                  )
                );
                
                // 根據消息內容生成快速回覆
                generateQuickReplies(accumulatedText);
                setIsLoading(false);
                break;
              } else if (eventData.type === 'error') {
                throw new Error(eventData.content || '處理請求時發生錯誤');
              }
            } catch (e) {
              console.error('解析事件數據錯誤:', e);
              throw e;
            }
          }
        }
      }    } catch (error) {
      console.error('Chat API error:', error);
      // Handle error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMsgId 
            ? { id: loadingMsgId, text: 'Sorry, an error occurred. Please try again later.', isAI: true, isStreaming: false } 
            : msg
        )
      );
      setIsLoading(false);
    }
  };
  // Generate quick replies based on AI response
  const generateQuickReplies = (text) => {
    // In a real application, you could use more complex logic or fetch related quick replies from an API
    // Simple demonstration:
    if (text.includes('deposit') || text.includes('payment')) {
      setQuickReplies(['How to add a bank card?', 'Which payment methods are supported?', 'What are the deposit limits?', 'Deposit issues']);
    } else if (text.includes('password') || text.includes('login')) {
      setQuickReplies(['Password reset process', 'Account security settings', 'Two-factor authentication', 'Contact support']);
    } else if (walletModeEnabled) {
      // Quick replies for Wallet mode
      setQuickReplies(['Check balance', 'Transaction history', 'Add new asset', 'Disable Wallet mode']);
    } else {
      // Default quick replies
      setQuickReplies(['Product features', 'Fees and charges', 'FAQ', 'Contact support']);
    }
  };
  // Send message
  const sendMessage = async (e) => {
    e && e.preventDefault();
    if (newMessage.trim() === '' || isLoading) return;

    // Add user message
    const userMessage = { id: generateUniqueId(), text: newMessage, isAI: false };
    setMessages(prev => [...prev, userMessage]);
    
    const currentMessage = newMessage;
    setNewMessage('');
    
    // Get current effective mode
    const effectiveMode = getEffectiveMode();
    
    // Process response based on mode
    await handleStreamResponse(currentMessage, effectiveMode);
  };

  // Handle quick reply click
  const handleQuickReplyClick = (reply) => {
    // Special quick reply handling
    if (reply === 'Switch to AI Assistant') {
      switchMode('ai');
      return;
    } else if (reply === 'Disable Wallet mode') {
      toggleWalletMode();
      return;
    }    
    setNewMessage(reply);
    // Slight delay to see the text in the input field
    setTimeout(() => sendMessage(), 300);
  };

  // Voice input functionality
  const toggleVoiceInput = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks = [];
      
      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunks.push(event.data);
      });
        mediaRecorder.addEventListener('stop', async () => {
        // Process recording result
        const audioBlob = new Blob(audioChunks);
        
        // Here should be logic to send the recording to speech recognition API
        // Simplified demonstration: Assume text is already converted
        setNewMessage('This is a message converted from voice input...');
        
        // Close microphone stream
        stream.getTracks().forEach(track => track.stop());
      });
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Add recording prompt
      handleSystemMessage('Listening to your voice, please speak...');
      
      // Set recording time limit (e.g., 10 seconds)
      setTimeout(() => {
        if (isRecording && mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
        }
      }, 10000);
      
    } catch (error) {
      console.error('Voice input error:', error);
      handleSystemMessage('Cannot access microphone. Please check permissions.');
    }
  };
  // Toggle theme mode
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Switch chat mode
  const switchMode = (newMode) => {
    if (newMode !== mode && !isLoading) {
      setMode(newMode);
      // Add mode switch notification
      handleSystemMessage(`You have switched to ${newMode === 'customer_service' ? 'Customer Service' : 'AI Assistant'} mode`);
      
      // If switching from AI to customer service, automatically disable wallet mode
      if (newMode === 'customer_service' && walletModeEnabled) {
        setWalletModeEnabled(false);
      }
      
      // Update quick replies
      if (newMode === 'customer_service') {
        setQuickReplies(['Request urgent support', 'Check ticket status', 'Schedule callback', 'Switch to AI Assistant']);
      } else {
        setQuickReplies(['Product features', 'Fees and charges', 'FAQ', 'Contact support']);
      }
    }
  };
  // Add fade in/out animation effect
  const handleChatBoxAnimation = () => {
    if (chatBoxRef.current) {
      chatBoxRef.current.classList.add(styles.fadeIn);
      setTimeout(() => {
        if (chatBoxRef.current) {
          chatBoxRef.current.classList.remove(styles.fadeIn);
        }
      }, 500);
    }
  };

  // Auto scroll to the latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Typewriter effect component
  const TypewriterText = ({ text, isActive }) => {
    if (!isActive) return text;

    return (
      <>
        {text}
        <span className={styles.cursor}></span>
      </>
    );
  };
  // Get button class name based on current mode
  const getButtonClassName = () => {
    if (mode === 'customer_service') {
      return `${styles.chatButton} ${styles.customerButton}`;
    } else if (walletModeEnabled) {
      return `${styles.chatButton} ${styles.walletButton}`; // Wallet button style
    } else {
      return styles.chatButton;
    }
  };
  const getUserMessageClassName = () => {
    if (mode === 'customer_service') {
      return `${styles.message} ${styles.userMessage} ${styles.customerUserMessage}`;
    } else if (walletModeEnabled) {
      return `${styles.message} ${styles.userMessage} ${styles.walletUserMessage}`; // Wallet user message style
    } else {
      return `${styles.message} ${styles.userMessage}`;
    }
  };

  const getSendButtonClassName = () => {
    if (mode === 'customer_service') {
      return `${styles.sendButton} ${styles.customerSendButton}`;
    } else if (walletModeEnabled) {
      return `${styles.sendButton} ${styles.walletSendButton}`; // Wallet send button style
    } else {
      return styles.sendButton;
    }
  };

  const getInputClassName = () => {
    if (mode === 'customer_service') {
      return `${styles.messageInput} ${styles.customerInput}`;
    } else if (walletModeEnabled) {
      return `${styles.messageInput} ${styles.walletInput}`; // Wallet input style
    } else {
      return `${styles.messageInput} ${styles.aiInput}`;
    }
  };
  const getActiveModeClassName = (buttonMode) => {
    if (buttonMode === mode) {
      if (mode === 'customer_service') {
        return `${styles.optionButton} ${styles.activeMode} ${styles.activeCustomerMode}`;
      } else if (walletModeEnabled) {
        return `${styles.optionButton} ${styles.activeMode} ${styles.activeWalletMode}`; // Wallet active style
      } else {
        return `${styles.optionButton} ${styles.activeMode} ${styles.activeAiMode}`;
      }
    }
    return styles.optionButton;
  };

  const getIndicatorClassName = () => {
    if (mode === 'customer_service') {
      return `${styles.indicatorSlider} ${styles.customerIndicator}`;
    } else if (walletModeEnabled) {
      return `${styles.indicatorSlider} ${styles.walletIndicator}`; // Wallet indicator style
    } else {
      return `${styles.indicatorSlider} ${styles.aiIndicator}`;
    }
  };
  // Get message dialog title
  const getMessageDialogTitle = () => {
    if (!selectedMessage) return '';
    if (selectedMessage.isAI) {
      if (mode === 'customer_service') {
        return 'Customer Service Message';
      } else if (walletModeEnabled) {
        return 'AI Wallet Assistant Message';
      } else {
        return 'AI Assistant Message';
      }
    } else {
      return 'Your Message';
    }
  };

  // Get header title
  const getHeaderTitle = () => {
    if (mode === 'customer_service') {
      return 'SeaWallet Customer Service';
    } else if (walletModeEnabled) {
      return 'SeaWallet AI Wallet Assistant';
    } else {
      return 'SeaWallet AI Assistant';
    }
  };

  // Get mode icon
  const getModeIcon = () => {
    if (mode === 'customer_service') {
      return '👤';
    } else if (walletModeEnabled) {
      return '💰';
    } else {
      return '🤖';
    }
  };

  return (
    <div className={styles.chatSupportContainer}>
      {/* 右下角的按鈕 */}      <button 
        className={getButtonClassName()} 
        onClick={toggleChat}
        aria-label="Support"
      >
        {isOpen ? '✕' : getModeIcon()}
      </button>

      {/* 對話框 */}
      {isOpen && (
        <div 
          ref={chatBoxRef}
          className={`${styles.chatBox} ${isDarkMode ? styles.nightMode : ''}`}
        >
          <div className={`${styles.chatHeader} ${
            mode === 'customer_service' 
              ? styles.customerHeader 
              : walletModeEnabled 
                ? styles.walletHeader 
                : styles.aiHeader
          }`}>
            <div className={styles.headerContent}>
              <div className={styles.modeIndicator}>
                {getModeIcon()}
              </div>
              <h3>{getHeaderTitle()}</h3>
            </div>
            
            {/* 主題切換按鈕 */}            <button 
              className={styles.themeToggle} 
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            
            <button 
              className={styles.closeButton} 
              onClick={toggleChat}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>
          
          <div className={styles.messagesContainer}>
            {messages.map((msg, index) => (
              <div 
                key={msg.id} 
                className={`${
                  msg.isSystem 
                    ? styles.systemMessage 
                    : msg.isAI 
                      ? styles.aiMessage 
                      : getUserMessageClassName()
                } ${msg.isStreaming ? styles.loadingMessage : ''} ${msg.isImportant ? styles.importantMessage : ''}`}
                style={{ 
                  animationDelay: `${index * 0.05}s`,
                  animationDuration: '0.5s'
                }}
                onClick={() => openMessageDialog(msg)}
              >
                {msg.isSystem ? (
                  <span className={styles.systemMessageBadge}>ℹ️</span>
                ) : msg.isAI ? (
                  <span className={styles.messageBadge}>
                    {mode === 'customer_service' ? '👤' : walletModeEnabled ? '💰' : '🤖'}
                  </span>
                ) : (
                  <span className={styles.userMessageBadge}>👤</span>
                )}
                <TypewriterText text={msg.text} isActive={msg.isStreaming} />
                {msg.isImportant && <span className={styles.importantBadge}>⭐</span>}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* 快速回覆按鈕 */}
          {/* {!isLoading && messages.length > 0 && messages[messages.length - 1].isAI && (
            <div className={styles.quickReplies}>
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  className={styles.quickReplyButton}
                  onClick={() => handleQuickReplyClick(reply)}
                >
                  {reply}
                </button>
              ))}
            </div>
          )} */}
          
          <form className={styles.inputContainer} onSubmit={sendMessage}>
            {/* 語音輸入按鈕 */}            <button
              type="button"
              className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
              onClick={toggleVoiceInput}
              aria-label={isRecording ? 'Stop Recording' : 'Voice Input'}
            >
              {isRecording ? '🔴' : '🎤'}
            </button>
            
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className={getInputClassName()}
              disabled={isLoading || isRecording}
            />
            <button 
              type="submit" 
              className={getSendButtonClassName()}
              disabled={newMessage.trim() === '' || isLoading || isRecording}
            >
              {isLoading ? 'Sending' : 'Send'} {isLoading ? '...' : '➤'}
            </button>
          </form>
          
          <div className={styles.optionsContainer}>
            <button 
              className={getActiveModeClassName('customer_service')} 
              onClick={() => switchMode('customer_service')}
              disabled={isLoading || isRecording}
            >              <span className={styles.optionIcon}>👤</span>
              Contact Support
            </button>
            <button 
              className={getActiveModeClassName('ai')}
              onClick={() => switchMode('ai')}
              disabled={isLoading || isRecording}
            >
              <span className={styles.optionIcon}>
                {walletModeEnabled ? '💰' : '🤖'}
              </span>
              AI Assistant
            </button>
          </div>
          
          {/* Wallet 模式開關 - 只在 AI 模式下顯示 */}
          {mode === 'ai' && (
            <div className={styles.walletModeToggle}>
              <label className={styles.toggleSwitch}>
                <input 
                  type="checkbox" 
                  checked={walletModeEnabled}
                  onChange={toggleWalletMode}
                  disabled={isLoading}
                />
                <span className={styles.toggleSlider}></span>
              </label>              <span className={styles.walletModeLabel}>
                {walletModeEnabled ? 'Wallet Mode Enabled' : 'Wallet Mode'}
              </span>
              
              {/* 只在錢包模式啟用時顯示上傳文件按鈕 */}
              {walletModeEnabled && (
                <button
                  type="button"
                  onClick={openFileDialog}
                  className={styles.uploadButton}
                  disabled={isLoading}
                >
                  📄
                </button>
              )}
            </div>
          )}
          
          <div className={styles.modeIndicatorBar}>
            <div 
              className={getIndicatorClassName()} 
              style={{ 
                transform: `translateX(${mode === 'customer_service' ? '0' : '100%'})` 
              }}
            />            <span className={styles.modeLabel}>
              Current mode: {
                mode === 'customer_service' 
                  ? 'Customer Service' 
                  : walletModeEnabled 
                    ? 'AI Wallet Assistant' 
                    : 'AI Assistant'
              }
            </span>
          </div>
        </div>
      )}

      {/* 訊息對話框 */}
      {dialogOpen && selectedMessage && (
        <div className={`${styles.messageDialog} ${isDarkMode ? styles.nightMode : ''}`}>
          <div 
            ref={dialogRef}
            className={`${styles.messageDialogContent} ${
              selectedMessage.isAI 
                ? mode === 'customer_service' 
                  ? styles.customerDialogContent 
                  : walletModeEnabled 
                    ? styles.walletDialogContent 
                    : styles.aiDialogContent 
                : styles.userDialogContent
            }`}
          >
            <div className={styles.messageDialogHeader}>
              <h4>{getMessageDialogTitle()}</h4>              <button 
                className={styles.dialogCloseBtn}
                onClick={closeMessageDialog}
                aria-label="Close Message Dialog"
              >
                ✕
              </button>
            </div>
            
            <div className={styles.messageDialogBody}>
              <p className={styles.messageDialogText}>
                {selectedMessage.text}
              </p>
              
              <div className={styles.messageDialogTime}>
                <small>                  {new Date().toLocaleTimeString()} · {selectedMessage.isAI ? 'Sent by system' : 'Sent by you'}
                </small>
              </div>
            </div>
            
            <div className={styles.messageDialogActions}>              <button 
                className={styles.dialogActionBtn}
                onClick={copyMessageText}
              >
                📋 Copy
              </button>
              <button 
                className={styles.dialogActionBtn}
                onClick={markAsImportant}
              >
                {selectedMessage.isImportant ? '⭐ Unmark' : '⭐ Mark as Important'}
              </button>
              <button 
                className={`${styles.dialogActionBtn} ${styles.dialogDeleteBtn}`}
                onClick={deleteMessage}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文件上傳對話框 */}
      {fileDialogOpen && (
        <div className={`${styles.messageDialog} ${isDarkMode ? styles.nightMode : ''}`}>
          <div 
            ref={fileDialogRef}
            className={`${styles.messageDialogContent} ${styles.fileDialogContent}`}
          >
            <div className={styles.messageDialogHeader}>              <h4>Upload File</h4>
              <button 
                className={styles.dialogCloseBtn}
                onClick={closeFileDialog}
                aria-label="Close File Upload Dialog"
              >
                ✕
              </button>
            </div>            
            <div className={styles.fileDialogBody}>
              <p>請上傳文件以增強 AI 錢包助手的功能。上傳的文件將直接用於問答上下文，同時系統會自動獲取您的錢包狀態信息。</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.csv,.json,.md"
                className={styles.fileInput}
              />
              <div className={styles.fileUploadArea} onClick={() => fileInputRef.current?.click()}>
                <div className={styles.uploadIcon}>📄</div>
                <p>點擊或拖拽文件至此</p>
                <small>支持 .txt, .csv, .json, .md 格式</small>
              </div>
            </div>    
            <div className={styles.messageDialogActions}>
              <button 
                className={styles.dialogActionBtn}
                onClick={closeFileDialog}
              >
                Cancel
              </button>
              <button 
                className={`${styles.dialogActionBtn} ${styles.confirmUploadBtn}`}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatSupport;