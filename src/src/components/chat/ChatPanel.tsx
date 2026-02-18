// ============================================================================
// 상담 채팅 패널 컴포넌트
// ============================================================================
'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import Card from '@/components/common/Card';
import { formatChatTime } from '@/utils/format';
import type { ChatRoom, ChatMessage } from '@/types';

export default function ChatPanel() {
  const { chatRooms, bookings, currentAdmin, setChatRooms } = useAppStore();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'all' | 'star' | 'done'>('all');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const rooms = useMemo(() => {
    const list = Object.values(chatRooms);
    if (tab === 'star') return list.filter((r) => r.starred);
    if (tab === 'done') return list.filter((r) => r.done);
    return list;
  }, [chatRooms, tab]);

  const unansweredCount = useMemo(() => {
    return Object.values(chatRooms).filter((r) => {
      const realMsgs = r.msgs.filter((m) => m.from !== 'system');
      return (
        realMsgs.length > 0 &&
        realMsgs[realMsgs.length - 1].from === 'customer'
      );
    }).length;
  }, [chatRooms]);

  const activeRoom = selectedRoom ? chatRooms[selectedRoom] : null;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeRoom?.msgs.length]);

  const sendMessage = () => {
    if (!message.trim() || !activeRoom) return;
    const newMsg: ChatMessage = {
      from: 'admin',
      sender: currentAdmin?.name || '관리자',
      text: message.trim(),
      ts: new Date().toISOString(),
    };
    const updated = {
      ...chatRooms,
      [activeRoom.id]: {
        ...activeRoom,
        msgs: [...activeRoom.msgs, newMsg],
        lastMsg: message.trim(),
        lastMsgTime: newMsg.ts,
      },
    };
    setChatRooms(updated);
    setMessage('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 h-[calc(100vh-120px)]">
      {/* 채팅방 목록 */}
      <Card className="!mb-0 overflow-hidden flex flex-col">
        <div className="flex gap-1 mb-3">
          {(['all', 'star', 'done'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-bold border-2 rounded-lg cursor-pointer ${
                tab === t
                  ? 'bg-museum-primary text-white border-museum-primary'
                  : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {t === 'all'
                ? `전체 ${unansweredCount > 0 ? `(${unansweredCount})` : ''}`
                : t === 'star'
                  ? '⭐ 중요'
                  : '✅ 완료'}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {rooms.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-xs">
              채팅방이 없습니다.
            </div>
          ) : (
            rooms.map((room) => {
              const lastCust = room.msgs
                .filter((m) => m.from === 'customer')
                .pop();
              const isUnread =
                room.msgs.length > 0 &&
                room.msgs.filter((m) => m.from !== 'system').pop()?.from ===
                  'customer';

              return (
                <div
                  key={room.id}
                  onClick={() => setSelectedRoom(room.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedRoom === room.id
                      ? 'bg-green-50 border border-museum-tertiary'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-museum-primary text-white flex items-center justify-center text-sm font-bold">
                      {room.name.charAt(0)}
                    </div>
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-700 truncate">
                        {room.starred && '⭐ '}{room.name}
                      </span>
                      <span className="text-[9px] text-gray-400">
                        {room.lastMsgTime &&
                          formatChatTime(room.lastMsgTime)}
                      </span>
                    </div>
                    {lastCust && (
                      <div className="text-[10px] text-gray-500 truncate mt-0.5">
                        {lastCust.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* 채팅 메시지 영역 */}
      <Card className="!mb-0 flex flex-col overflow-hidden">
        {activeRoom ? (
          <>
            {/* 채팅 헤더 */}
            <div className="flex justify-between items-center pb-3 border-b border-museum-border mb-3">
              <div>
                <span className="text-sm font-extrabold text-museum-primary">
                  💬 {activeRoom.name}
                </span>
                {activeRoom.starred && (
                  <span className="ml-1 text-yellow-500">⭐</span>
                )}
              </div>
              <div className="flex gap-1.5 text-xs">
                <span className="text-gray-400">
                  {activeRoom.msgs.length}개 메시지
                </span>
              </div>
            </div>

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto space-y-2 pb-3">
              {activeRoom.msgs
                .filter((m) => m.from !== 'system')
                .map((msg, i) => {
                  const isCustomer = msg.from === 'customer';
                  return (
                    <div
                      key={i}
                      className={`flex ${
                        isCustomer ? '' : 'justify-end'
                      } gap-1.5`}
                    >
                      {isCustomer ? (
                        <div className="flex items-end gap-1">
                          <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-none text-[13px] text-gray-800 max-w-[70%]">
                            <div className="text-[10px] text-gray-400 font-bold mb-0.5">
                              {msg.sender || activeRoom.name}
                            </div>
                            {msg.text}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {msg.ts &&
                              new Date(msg.ts).toLocaleTimeString(
                                'ko-KR',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className="text-[10px] text-gray-400">
                            {msg.ts &&
                              new Date(msg.ts).toLocaleTimeString(
                                'ko-KR',
                                { hour: '2-digit', minute: '2-digit' }
                              )}
                          </span>
                          <div className="bg-museum-primary px-3 py-2 rounded-xl rounded-br-none text-[13px] text-white max-w-[70%]">
                            {msg.text}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              <div ref={chatEndRef} />
            </div>

            {/* 입력 */}
            <div className="flex gap-2 pt-3 border-t border-museum-border">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="답변을 입력하세요..."
                className="flex-1 border border-museum-border rounded-lg px-3 py-2 text-xs outline-none focus:border-museum-tertiary"
              />
              <button
                onClick={sendMessage}
                className="px-4 py-2 bg-museum-primary text-white border-none rounded-lg text-xs font-bold cursor-pointer hover:bg-museum-secondary"
              >
                전송
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm">채팅방을 선택하세요</p>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
