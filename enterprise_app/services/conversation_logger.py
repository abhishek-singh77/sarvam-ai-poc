#!/usr/bin/env python3
"""
Conversation Logger Service for tracking STT → LLM → TTS flow
"""

import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime
from utils.logger import get_logger

logger = get_logger(__name__)

class ConversationEntry:
    """Represents a single conversation entry"""
    
    def __init__(self, entry_type: str, content: str, metadata: Dict[str, Any] | None = None):
        self.timestamp = datetime.now().isoformat()
        self.entry_type = entry_type  # 'user_speech', 'stt_result', 'llm_response', 'tts_input', 'agent_speech'
        self.content = content
        self.metadata = metadata or {}
        self.duration_ms = None
    
    def set_duration(self, start_time: float):
        """Set duration from start time"""
        self.duration_ms = int((time.time() - start_time) * 1000)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "timestamp": self.timestamp,
            "type": self.entry_type,
            "content": self.content,
            "metadata": self.metadata,
            "duration_ms": self.duration_ms
        }

class ConversationLogger:
    """Service for logging conversation flow"""
    
    def __init__(self):
        self.conversations: Dict[str, List[ConversationEntry]] = {}
        self.current_timers: Dict[str, float] = {}
    
    def start_conversation_turn(self, room_id: str, turn_id: str | None = None) -> str:
        """Start a new conversation turn"""
        if not turn_id:
            turn_id = f"turn_{int(time.time() * 1000)}"
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.current_timers[room_id] = time.time()
        logger.info("🎤 CONVERSATION: Started turn", extra={"turn_id": turn_id, "room_id": room_id})
        return turn_id
    
    def log_user_speech(self, room_id: str, speech_text: str, metadata: Dict[str, Any] | None = None):
        """Log user speech input"""
        entry = ConversationEntry("user_speech", speech_text, metadata)
        if room_id in self.current_timers:
            entry.set_duration(self.current_timers[room_id])
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.conversations[room_id].append(entry)
        logger.info("🎤 CONVERSATION: User speech logged", extra={"room_id": room_id, "speech_preview": speech_text[:50]})
    
    def log_stt_result(self, room_id: str, stt_text: str, confidence: float | None = None, metadata: Dict[str, Any] | None = None):
        """Log STT (Speech-to-Text) result"""
        stt_metadata = metadata or {}
        if confidence is not None:
            stt_metadata["confidence"] = confidence
        
        entry = ConversationEntry("stt_result", stt_text, stt_metadata)
        if room_id in self.current_timers:
            entry.set_duration(self.current_timers[room_id])
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.conversations[room_id].append(entry)
        logger.info("🎤 CONVERSATION: STT result logged", extra={"room_id": room_id, "stt_preview": stt_text[:50]})
    
    def log_llm_response(self, room_id: str, llm_text: str, metadata: Dict[str, Any] | None = None):
        """Log LLM response"""
        entry = ConversationEntry("llm_response", llm_text, metadata)
        if room_id in self.current_timers:
            entry.set_duration(self.current_timers[room_id])
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.conversations[room_id].append(entry)
        logger.info("🎤 CONVERSATION: LLM response logged", extra={"room_id": room_id, "llm_preview": llm_text[:50]})
    
    def log_tts_input(self, room_id: str, tts_text: str, metadata: Dict[str, Any] | None = None):
        """Log TTS (Text-to-Speech) input"""
        entry = ConversationEntry("tts_input", tts_text, metadata)
        if room_id in self.current_timers:
            entry.set_duration(self.current_timers[room_id])
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.conversations[room_id].append(entry)
        logger.info("🎤 CONVERSATION: TTS input logged", extra={"room_id": room_id, "tts_preview": tts_text[:50]})
    
    def log_agent_speech(self, room_id: str, speech_text: str, metadata: Dict[str, Any] | None = None):
        """Log agent speech output"""
        entry = ConversationEntry("agent_speech", speech_text, metadata)
        if room_id in self.current_timers:
            entry.set_duration(self.current_timers[room_id])
        
        if room_id not in self.conversations:
            self.conversations[room_id] = []
        
        self.conversations[room_id].append(entry)
        logger.info("🎤 CONVERSATION: Agent speech logged", extra={"room_id": room_id, "speech_preview": speech_text[:50]})
    
    def get_conversation_history(self, room_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get conversation history for a room"""
        if room_id not in self.conversations:
            return []
        
        # Get the last 'limit' entries
        recent_entries = self.conversations[room_id][-limit:]
        return [entry.to_dict() for entry in recent_entries]
    
    def get_latest_conversation(self, room_id: str) -> Dict[str, Any] | None:
        """Get the latest conversation entry for a room"""
        if room_id not in self.conversations or not self.conversations[room_id]:
            return None
        
        latest_entry = self.conversations[room_id][-1]
        return latest_entry.to_dict()
    
    def clear_conversation(self, room_id: str) -> bool:
        """Clear conversation history for a room"""
        if room_id in self.conversations:
            del self.conversations[room_id]
            logger.info("🎤 CONVERSATION: Cleared conversation history", extra={"room_id": room_id})
            return True
        return False
    
    def get_conversation_stats(self, room_id: str) -> Dict[str, Any]:
        """Get conversation statistics for a room"""
        if room_id not in self.conversations:
            return {
                "total_entries": 0,
                "user_speeches": 0,
                "agent_speeches": 0,
                "stt_results": 0,
                "llm_responses": 0,
                "tts_inputs": 0
            }
        
        entries = self.conversations[room_id]
        stats = {
            "total_entries": len(entries),
            "user_speeches": len([e for e in entries if e.entry_type == "user_speech"]),
            "agent_speeches": len([e for e in entries if e.entry_type == "agent_speech"]),
            "stt_results": len([e for e in entries if e.entry_type == "stt_result"]),
            "llm_responses": len([e for e in entries if e.entry_type == "llm_response"]),
            "tts_inputs": len([e for e in entries if e.entry_type == "tts_input"])
        }
        
        return stats

# Global instance
conversation_logger = ConversationLogger()
