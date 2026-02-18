import { useState } from 'react';
import {
  Search,
  Send,
  Paperclip,
  Image,
  Smile,
  MoreVertical,
  Phone,
  Video,
  Users,
  Hash,
  Plus,
  Check,
  CheckCheck,
} from 'lucide-react';
import Card from '../components/common/Card';

interface ChatRoom {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  lastMessage: string;
  lastTime: string;
  unread: number;
  avatar: string;
  online?: boolean;
}

interface Message {
  id: string;
  sender: string;
  content: string;
  time: string;
  isMe: boolean;
  read: boolean;
  type: 'text' | 'image' | 'system';
}

const chatRooms: ChatRoom[] = [
  { id: '1', name: '운영팀', type: 'group', lastMessage: '내일 단체 예약 확인 부탁드립니다', lastTime: '방금 전', unread: 3, avatar: '운', online: true },
  { id: '2', name: '이운영', type: 'direct', lastMessage: '체험교실B 점검 완료했습니다', lastTime: '10분 전', unread: 1, avatar: '이' },
  { id: '3', name: '공지사항', type: 'channel', lastMessage: '2월 셋째주 근무 일정 안내', lastTime: '1시간 전', unread: 0, avatar: '#' },
  { id: '4', name: '박교육', type: 'direct', lastMessage: '프로그램 자료 보내드렸습니다', lastTime: '2시간 전', unread: 0, avatar: '박' },
  { id: '5', name: '대행사 소통', type: 'group', lastMessage: '행복투어 3월 예약건 안내', lastTime: '3시간 전', unread: 2, avatar: '대' },
  { id: '6', name: '최마케팅', type: 'direct', lastMessage: '이벤트 포스터 시안 확인해주세요', lastTime: '어제', unread: 0, avatar: '최' },
  { id: '7', name: '교육팀', type: 'group', lastMessage: '신규 프로그램 기획안 공유합니다', lastTime: '어제', unread: 0, avatar: '교' },
];

const messages: Message[] = [
  { id: '1', sender: '김직원', content: '안녕하세요, 내일 한국초등학교 단체 예약 건입니다.', time: '09:30', isMe: false, read: true, type: 'text' },
  { id: '2', sender: '김직원', content: '30명 예약인데, 인원이 27명으로 변경될 수 있다고 합니다.', time: '09:31', isMe: false, read: true, type: 'text' },
  { id: '3', sender: '나', content: '네, 확인했습니다. 체험교실A에서 진행하면 될까요?', time: '09:35', isMe: true, read: true, type: 'text' },
  { id: '4', sender: '이직원', content: '체험교실A 내일 10시부터 준비 완료됩니다!', time: '09:40', isMe: false, read: true, type: 'text' },
  { id: '5', sender: '나', content: '좋습니다. 김직원님이 체험 프로그램 리드 부탁드립니다.', time: '09:42', isMe: true, read: true, type: 'text' },
  { id: '6', sender: '김직원', content: '네 알겠습니다. 재료 준비도 미리 해놓겠습니다.', time: '09:45', isMe: false, read: true, type: 'text' },
  { id: '7', sender: '박직원', content: '저도 보조로 투입되면 좋겠습니다. 30명이면 혼자 힘들 수 있어요.', time: '09:50', isMe: false, read: true, type: 'text' },
  { id: '8', sender: '나', content: '박직원님도 함께 해주시면 좋겠습니다. 감사합니다!', time: '09:52', isMe: true, read: true, type: 'text' },
  { id: '9', sender: '시스템', content: '이직원님이 체험교실A 예약을 확정했습니다.', time: '10:00', isMe: false, read: true, type: 'system' },
  { id: '10', sender: '김직원', content: '내일 단체 예약 확인 부탁드립니다', time: '10:05', isMe: false, read: false, type: 'text' },
];

export default function ChatPage() {
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom>(chatRooms[0]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRooms = chatRooms.filter((room) =>
    room.name.includes(searchQuery)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">채팅</h1>
          <p className="text-xs text-text-muted mt-0.5">팀 소통 및 업무 협업</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-200px)]">
        {/* 채팅방 목록 */}
        <Card padding="none" className="lg:col-span-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="대화방 검색..."
                className="pl-9 pr-4 py-2 w-full text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 transition-colors border-b border-border/50 text-left ${
                  selectedRoom?.id === room.id ? 'bg-museum-green/5' : ''
                }`}
              >
                <div className="relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    room.type === 'channel' ? 'bg-purple-100 text-purple-600' :
                    room.type === 'group' ? 'bg-blue-100 text-blue-600' :
                    'bg-museum-green/10 text-museum-green'
                  }`}>
                    {room.type === 'channel' ? <Hash className="w-4 h-4" /> : room.avatar}
                  </div>
                  {room.online && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate">{room.name}</p>
                    <span className="text-[10px] text-text-muted shrink-0">{room.lastTime}</span>
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">{room.lastMessage}</p>
                </div>
                {room.unread > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                    {room.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </Card>

        {/* 채팅 영역 */}
        <Card padding="none" className="lg:col-span-3 flex flex-col overflow-hidden">
          {/* 채팅방 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                selectedRoom.type === 'group' ? 'bg-blue-100 text-blue-600' : 'bg-museum-green/10 text-museum-green'
              }`}>
                {selectedRoom.avatar}
              </div>
              <div>
                <p className="text-sm font-semibold">{selectedRoom.name}</p>
                <p className="text-[11px] text-text-muted">
                  {selectedRoom.type === 'group' ? '그룹 채팅' : selectedRoom.type === 'channel' ? '채널' : '1:1 채팅'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Phone className="w-4 h-4 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Video className="w-4 h-4 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <Users className="w-4 h-4 text-text-secondary" />
              </button>
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <MoreVertical className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <span className="text-[11px] text-text-muted bg-gray-100 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} gap-2`}
                >
                  {!msg.isMe && (
                    <div className="w-8 h-8 rounded-full bg-museum-green/10 text-museum-green flex items-center justify-center text-xs font-bold shrink-0">
                      {msg.sender.charAt(0)}
                    </div>
                  )}
                  <div className={`max-w-[70%] ${msg.isMe ? 'order-first' : ''}`}>
                    {!msg.isMe && (
                      <p className="text-[11px] text-text-muted mb-1">{msg.sender}</p>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        msg.isMe
                          ? 'bg-museum-green text-white rounded-tr-sm'
                          : 'bg-gray-100 text-text-primary rounded-tl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <div className={`flex items-center gap-1 mt-0.5 ${msg.isMe ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-text-muted">{msg.time}</span>
                      {msg.isMe && (
                        msg.read
                          ? <CheckCheck className="w-3 h-3 text-blue-500" />
                          : <Check className="w-3 h-3 text-text-muted" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 메시지 입력 */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="flex items-end gap-2">
              <div className="flex items-center gap-1">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Plus className="w-4 h-4 text-text-secondary" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Image className="w-4 h-4 text-text-secondary" />
                </button>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Paperclip className="w-4 h-4 text-text-secondary" />
                </button>
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="w-full px-4 py-2.5 text-sm border border-border rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green focus:bg-white pr-10"
                  onKeyDown={(e) => e.key === 'Enter' && messageInput.trim() && setMessageInput('')}
                />
                <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-lg transition-colors">
                  <Smile className="w-4 h-4 text-text-muted" />
                </button>
              </div>
              <button
                className={`p-2.5 rounded-xl transition-colors ${
                  messageInput.trim()
                    ? 'bg-museum-green text-white hover:bg-museum-green-light'
                    : 'bg-gray-100 text-text-muted'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
