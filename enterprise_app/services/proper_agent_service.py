#!/usr/bin/env python3
"""
Proper VideoSDK agent service using the agents framework
Based on the VideoSDK agents example pattern with voice agent capabilities
"""

import asyncio
import json
import time
import os
import threading
import traceback
import re
from typing import Dict, Any, List, Optional
from utils.config.settings import get_settings
from utils.logging.logger import get_logger
from .conversation_logger import conversation_logger
from .workflow_service import workflow_service
from videosdk.agents import Agent, AgentSession, JobContext, RoomOptions, function_tool, ConversationFlow, WorkerJob, Options
from videosdk.agents import CascadingPipeline, STT, TTS, LLM
from videosdk.plugins.sarvamai import SarvamAISTT, SarvamAITTS, SarvamAILLM
from videosdk.plugins.google import GoogleLLM, GoogleTTS
from videosdk.plugins.silero import SileroVAD
from videosdk.plugins.turn_detector import TurnDetector, pre_download_model
from videosdk.plugins.rnnoise import RNNoise
from plugins.wav2lip import Wav2LipAvatar
from plugins.wav2lip.true_sync_avatar import TrueSyncWav2LipAvatar
from services.avatar_agent_service import avatar_agent_service

logger = get_logger(__name__)


class CustomCascadingPipeline(CascadingPipeline):
    """
    Custom CascadingPipeline that adds video handling capabilities.
    """
    
    async def on_video_delta(self, frame):
        """
        Handle video frame processing.
        This method is called by VideoSDK when video frames are received.
        """
        # For now, just pass through without processing
        # This prevents the AttributeError
        pass

class KYCVoiceAgent(Agent):
    """
    KYC Voice Agent that helps with identity verification process using voice interaction
    """
    
    def __init__(self):
        instructions = """
        You are a KYC (Know Your Customer) Voice Assistant. Your role is to guide users through the identity verification process using natural conversation.
        
        Your responsibilities:
        1. Greet the user warmly and explain the KYC process
        2. Guide them through each step of verification conversationally
        3. Ask for required documents (PAN card, Aadhaar card, etc.)
        4. Help them take clear photos of their documents
        5. Verify the information provided using available tools
        6. Answer any questions they may have
        7. Be patient, friendly, and professional
        8. Use natural speech patterns and maintain conversation flow
        
        WORKFLOW MANAGEMENT:
        - Always check the current workflow step using get_current_workflow_step(room_id)
        - Guide the user through each step based on the workflow
        - When a step is completed, use complete_workflow_step(room_id, step_id, data) to mark it as done
        - Provide clear instructions for each step type:
          * selfie_capture: Guide user to take a clear selfie
          * questionnaire: Ask the required questions and collect answers
          * id_upload: Help user upload their ID document
          * verification: Confirm completion and next steps
        
        IMPORTANT INTERRUPTION HANDLING:
        - Always listen for user interruptions while speaking
        - If the user starts speaking while you're talking, immediately stop and listen
        - Wait for the user to finish speaking before responding
        - Acknowledge their interruption politely (e.g., "I understand, please go ahead")
        - Be responsive to user questions and concerns at any time
        
        CRITICAL SPEECH RULES:
        - NEVER include tool code, function calls, or technical details in your speech
        - NEVER say things like "complete_workflow_step" or show function names
        - NEVER include URLs, error codes, or technical jargon in speech
        - NEVER mention that you are calling functions or using tools
        - Keep your speech natural, conversational, and user-friendly
        - Only speak what the user needs to hear, not internal system operations
        - When you use tools, do so silently and only speak the result to the user
        - Your responses should be conversational, not technical
        
        Always speak clearly and provide step-by-step instructions in a conversational manner.
        If the user seems confused, offer to repeat or clarify any step.
        Use the available tools to verify documents and guide photo capture.
        """
        
        super().__init__(
            instructions=instructions,
            agent_id="kyc-voice-agent"
        )
    
    async def on_enter(self) -> None:
        """Called when the agent enters the meeting"""
        logger.info("🎯 KYC Voice Agent entered the meeting")
        # Note: We'll handle the greeting in the session setup
        pass
    
    async def on_exit(self) -> None:
        """Called when the agent exits the meeting"""
        logger.info("🎯 KYC Voice Agent exited the meeting")
        # Note: We'll handle the farewell in the session cleanup
        pass

class ProperAgentService:
    """
    Proper VideoSDK agent service using the agents framework with Worker pattern
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.active_agents: Dict[str, Any] = {}
        self.agent_jobs: Dict[str, WorkerJob] = {}
        self.agent_sessions: Dict[str, AgentSession] = {}
        
        # Thread lock to prevent race conditions
        self._agent_start_lock = threading.Lock()
        
        # Initialize Wav2Lip avatar based on configuration
        self.wav2lip_avatar = None
        if self.settings.wav2lip_enabled:
            if self.settings.avatar_implementation.lower() == "true_sync":
                # For true sync, we'll create a separate avatar participant
                # But we still need a basic avatar for the main agent pipeline
                logger.info("🎬 True Sync avatar will be created as separate participant")
                # Use basic Wav2Lip avatar for the main agent pipeline
                self.wav2lip_avatar = self._initialize_avatar_by_config()
                if self.wav2lip_avatar:
                    logger.info("🎬 Basic Wav2Lip avatar initialized for main agent pipeline")
            else:
                # For basic wav2lip, use the avatar parameter in pipeline
                self.wav2lip_avatar = self._initialize_avatar_by_config()
        
        # Pre-download the Turn Detector model
        try:
            pre_download_model()
            logger.info("✅ Turn Detector model pre-downloaded successfully")
        except Exception as e:
            logger.warning("Failed to pre-download Turn Detector model", extra={"error": str(e)})
    
    async def join_agent_to_room(
        self, 
        room_id: str, 
        agent_participant_id: str, 
        agent_token: str,
        workflow_json: str = ""
    ) -> Dict[str, Any]:
        """
        Join AI agent to the VideoSDK room using the proper Worker pattern
        
        Args:
            room_id: VideoSDK room ID
            agent_participant_id: Agent's participant ID
            agent_token: Agent's authentication token
            workflow_json: KYC workflow configuration
            
        Returns:
            Dict with agent status and meeting info
        """
        # Use a lock to ensure only one agent starts at a time
        with self._agent_start_lock:
            try:
                logger.info(f"🎯 Starting proper agent {agent_participant_id} for room {room_id}")
                
                # Check if agent is already active for this room
                if room_id in self.active_agents and self.active_agents[room_id]["status"] == "active":
                    logger.info("Agent already active for room, returning success", extra={"room_id": room_id})
                    return {
                        "status": "success",
                        "room_id": room_id,
                        "agent_participant_id": agent_participant_id,
                        "message": "Agent already active for this room"
                    }
                
                # Store agent info
                self.active_agents[room_id] = {
                    "participant_id": agent_participant_id,
                    "workflow": workflow_json,
                    "status": "starting"
                }
                
                # Load workflow for this room
                if workflow_json:
                    workflow_service.load_workflow(room_id, workflow_json)
                else:
                    workflow_service.load_workflow(room_id)
                
                # Store the original token if it exists
                original_token = os.environ.get("VIDEOSDK_AUTH_TOKEN")
                
                # Set the auth token for this specific job
                os.environ["VIDEOSDK_AUTH_TOKEN"] = agent_token
                logger.info(f"✅ Set VIDEOSDK_AUTH_TOKEN for room {room_id}")
                
                try:
                    # Create the worker job using the proper VideoSDK pattern
                    options = Options(register=False)
                    context = self._make_job_context(room_id, agent_token)
                    
                    # Set connection info for Wav2Lip avatar if enabled
                    # Wav2Lip avatar connection info will be set during the connect() call
                    # No need for separate set_connection_info call
                    
                    job = WorkerJob(
                        entrypoint=self._start_agent_session,
                        jobctx=context,
                        options=options
                    )
                    
                    # Store the job for proper cleanup
                    self.agent_jobs[room_id] = job
                    
                    # Start the job in a separate thread to avoid event loop conflict
                    job_thread = threading.Thread(target=job.start, daemon=True)
                    job_thread.start()
                    
                    # Store the thread for cleanup
                    self.active_agents[room_id]["thread"] = job_thread
                    
                    # Update status to active
                    self.active_agents[room_id]["status"] = "active"
                    
                    logger.info(f"✅ Proper agent {agent_participant_id} started for room {room_id}")
                    
                    return {
                        "status": "success",
                        "room_id": room_id,
                        "agent_token": agent_token,
                        "agent_participant_id": agent_participant_id,
                        "message": "Proper agent started and ready for conversation"
                    }
                    
                finally:
                    # Restore the original token or remove it if it didn't exist
                    if original_token is not None:
                        os.environ["VIDEOSDK_AUTH_TOKEN"] = original_token
                    else:
                        os.environ.pop("VIDEOSDK_AUTH_TOKEN", None)
                    logger.info(f"✅ Restored VIDEOSDK_AUTH_TOKEN for room {room_id}")
                
            except Exception as e:
                logger.error(f"❌ Failed to start proper agent for room: {e}")
                logger.error(f"Traceback: {traceback.format_exc()}")
                
                return {
                    "status": "error",
                    "room_id": room_id,
                    "agent_participant_id": agent_participant_id,
                    "error": str(e)
                }
    
    def _make_job_context(self, room_id: str, agent_token: str) -> JobContext:
        """Create JobContext for the agent session following VideoSDK documentation"""
        room_options = RoomOptions(
            room_id=room_id,
            auth_token=agent_token,
            name="KYC AI Agent",
            playground=False,  # Set to False for production use
            vision=True,  # Enable vision for video streaming
            avatar=self.wav2lip_avatar  # Pass the Wav2Lip avatar
        )
        
        return JobContext(room_options=room_options)
    
    def _initialize_avatar_by_config(self):
        """
        Initialize basic Wav2Lip avatar for the main agent pipeline.
        Note: True Sync functionality is handled separately via avatar participant service.
        
        Returns:
            Basic Wav2Lip avatar instance or None if initialization fails
        """
        try:
            logger.info("🎬 Initializing basic Wav2Lip avatar for main agent pipeline...")
            avatar = Wav2LipAvatar(wav2lip_url=self.settings.wav2lip_url)
            logger.info("✅ Basic Wav2Lip avatar initialized successfully")
            return avatar
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize basic Wav2Lip avatar: {e}")
            return None
    
    # Removed old TTS wrapper - now using proper avatar agent approach
    
    # Removed redundant methods - now using proper avatar_agent_service
    
    async def _create_avatar_agent_for_room(self, room_id: str, agent_token: str) -> bool:
        """
        Create avatar agent as separate participant for the room.
        
        Args:
            room_id: VideoSDK room ID
            agent_token: Authentication token
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"🎬 Creating avatar agent for room {room_id}")
            
            # Create avatar agent as separate participant
            success = await avatar_agent_service.create_avatar_agent(
                room_id=room_id,
                meeting_id=room_id,  # Using room_id as meeting_id
                token=agent_token
            )
            
            if success:
                logger.info(f"✅ Avatar agent created for room {room_id}")
                return True
            else:
                logger.error(f"❌ Failed to create avatar agent for room {room_id}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Error creating avatar agent for room {room_id}: {e}")
            return False
    
    # Removed old separate avatar participant method - now using proper avatar agent
    
    def _setup_conversation_logging(self, session: AgentSession, room_id: str):
        """Set up conversation logging for the agent session"""
        try:
            # Override the session's say method to log TTS input
            original_say = session.say
            
            async def logged_say(message: str, **kwargs):
                turn_id = conversation_logger.start_conversation_turn(room_id)
                conversation_logger.log_tts_input(room_id, message, **kwargs)
                logger.info(f"🔊 AGENT SAYING: '{message[:100]}{'...' if len(message) > 100 else ''}'")
                
                # For True Sync mode, send text to Avatar Agent (which will generate its own TTS)
                if self.settings.avatar_implementation.lower() == "true_sync":
                    try:
                        # Send text to Avatar Agent - it will generate its own TTS audio
                        await self._send_text_to_avatar(message, room_id)
                    except Exception as e:
                        logger.error(f"❌ Failed to send text to Avatar Agent: {e}")
                
                return await original_say(message, **kwargs)
            
            session.say = logged_say
            
            # Set up pipeline logging if possible
            if hasattr(session, 'pipeline') and session.pipeline:
                self._setup_pipeline_logging(session.pipeline, room_id)
            
            logger.info(f"✅ CONVERSATION LOGGING: Set up for room {room_id}")
            
        except Exception as e:
            logger.error(f"❌ CONVERSATION LOGGING: Failed to set up for room {room_id}: {e}")
    
    def _setup_pipeline_logging(self, pipeline, room_id: str):
        """Set up logging for pipeline components"""
        try:
            # Log STT results
            if hasattr(pipeline, 'stt') and pipeline.stt:
                original_stt_process = getattr(pipeline.stt, 'process', None)
                if original_stt_process:
                    def logged_stt_process(audio_data, **kwargs):
                        turn_id = conversation_logger.start_conversation_turn(room_id)
                        conversation_logger.log_user_speech(room_id, str(audio_data))
                        result = original_stt_process(audio_data, **kwargs)
                        if hasattr(result, 'text'):
                            conversation_logger.log_stt_result(room_id, result.text)
                        return result
                    pipeline.stt.process = logged_stt_process
            
            # Log LLM responses
            if hasattr(pipeline, 'llm') and pipeline.llm:
                original_llm_generate = getattr(pipeline.llm, 'generate', None)
                if original_llm_generate:
                    def logged_llm_generate(prompt, **kwargs):
                        start_time = time.time()
                        result = original_llm_generate(prompt, **kwargs)
                        processing_time = int((time.time() - start_time) * 1000)
                        
                        turn_id = conversation_logger.start_conversation_turn(room_id)
                        if hasattr(result, 'text'):
                            conversation_logger.log_llm_response(
                                room_id, result.text, 
                                model=getattr(pipeline.llm, 'model', 'unknown'),
                                processing_time_ms=processing_time
                            )
                        return result
                    pipeline.llm.generate = logged_llm_generate
            
            logger.info(f"✅ PIPELINE LOGGING: Set up for room {room_id}")
            
        except Exception as e:
            logger.error(f"❌ PIPELINE LOGGING: Failed to set up for room {room_id}: {e}")
    
    def _setup_response_filtering(self, session: AgentSession, room_id: str):
        """Set up response filtering to prevent function calls from being spoken"""
        try:
            # Override the session's say method to filter out function calls
            original_say = session.say
            
            async def filtered_say(message: str, **kwargs):
                # Filter out function calls and technical details
                filtered_message = self._filter_function_calls(message)
                
                # Only speak if there's meaningful content after filtering
                if filtered_message.strip() and len(filtered_message.strip()) > 3:
                    logger.info(f"🔊 FILTERED AGENT SAYING: '{filtered_message[:100]}{'...' if len(filtered_message) > 100 else ''}'")
                    
                    # Send text to avatar for lip-sync generation
                    if self.wav2lip_avatar or self.settings.avatar_implementation.lower() == "true_sync":
                        await self._send_text_to_avatar(filtered_message, room_id)
                    
                    try:
                        return await original_say(filtered_message, **kwargs)
                    except Exception as e:
                        logger.error(f"❌ TTS failed for filtered message: {e}")
                        # Fallback: try with original message if filtered version fails
                        if filtered_message != message:
                            logger.info("🔄 FALLBACK: Trying with original message")
                            try:
                                return await original_say(message, **kwargs)
                            except Exception as e2:
                                logger.error(f"❌ TTS failed for original message too: {e2}")
                                return None
                        return None
                else:
                    logger.info("🔇 FILTERED OUT: No meaningful content to speak after filtering")
                    return None
            
            session.say = filtered_say
            logger.info(f"✅ RESPONSE FILTERING: Set up for room {room_id}")
            
        except Exception as e:
            logger.error(f"❌ RESPONSE FILTERING: Failed to set up for room {room_id}: {e}")
    
    async def _send_text_to_avatar(self, text: str, room_id: str = None) -> None:
        """
        Send text to avatar based on implementation type.
        
        Args:
            text: Text to send to avatar
            room_id: Room ID for separate avatar participant
        """
        try:
            logger.info(f"🎬🎬🎬 _send_text_to_avatar called with text: '{text[:50]}...'")
            logger.info(f"🎬🎬🎬 Room ID: {room_id}")
            logger.info(f"🎬🎬🎬 Avatar implementation: {self.settings.avatar_implementation}")
            
            # Check if using true sync (separate avatar agent)
            if self.settings.avatar_implementation.lower() == "true_sync" and room_id:
                logger.info(f"🎬🎬🎬 Using True Sync mode, sending to avatar agent")
                # Send to avatar agent - separate participant with custom audio/video tracks
                try:
                    # Send text to avatar agent
                    success = await avatar_agent_service.send_text_to_avatar_agent(
                        room_id=room_id,
                        text=text
                    )
                    if success:
                        logger.info(f"🎬🎬🎬 ✅ Text sent to avatar agent: '{text[:50]}...'")
                    else:
                        logger.error(f"🎬🎬🎬 ❌ Failed to send text to avatar agent: '{text[:50]}...'")
                except Exception as e:
                    logger.error(f"🎬🎬🎬 ❌ Error sending text to avatar agent: {e}")
                
                return
            
            # Handle avatar parameter approach (basic wav2lip)
            if not self.wav2lip_avatar:
                return
            
            # Check avatar type and send accordingly
            if hasattr(self.wav2lip_avatar, 'send_text_with_audio_sync'):
                # True Sync avatar - use advanced method with audio sync
                tts_timestamp = time.time()
                await self.wav2lip_avatar.send_text_with_audio_sync(text, audio_timestamp=tts_timestamp)
                logger.info(f"🎬 Text with audio sync sent to True Sync avatar: '{text[:50]}...'")
                
            elif hasattr(self.wav2lip_avatar, 'send_text_with_tts_sync'):
                # TTS Sync avatar - use TTS sync method
                tts_timestamp = time.time()
                await self.wav2lip_avatar.send_text_with_tts_sync(text, tts_timestamp)
                logger.info(f"🎬 Text with TTS sync sent to TTS Sync avatar: '{text[:50]}...'")
                
            elif hasattr(self.wav2lip_avatar, 'send_text'):
                # Basic Wav2Lip avatar - use original method
                await self.wav2lip_avatar.send_text(text)
                logger.info(f"🎬 Text sent to basic Wav2Lip avatar: '{text[:50]}...'")
                
            else:
                logger.warning("⚠️ Unknown avatar type, cannot send text")
                
        except Exception as e:
            logger.warning(f"⚠️ Failed to send text to avatar: {e}")
    
    
    def _filter_function_calls(self, message: str) -> str:
        """Filter out function calls and technical details from the message"""
        
        # If message is too short or mostly punctuation, return original
        if len(message.strip()) < 10 or len(re.sub(r'[^\w\s]', '', message)) < 5:
            return message
        
        # Remove specific function call patterns (more targeted)
        patterns_to_remove = [
            r'complete_workflow_step\([^)]*\)',  # Function calls
            r'get_current_workflow_step\([^)]*\)',  # Function calls
            r'\[function_call\]',  # Function call markers
            r'\[tool_use\]',  # Tool use markers
            r'<function_call>.*?</function_call>',  # XML-style function calls
            r'```.*?```',  # Code blocks
            r'`[^`]+`',  # Inline code
            r'https?://[^\s]+',  # URLs
        ]
        
        filtered_message = message
        for pattern in patterns_to_remove:
            filtered_message = re.sub(pattern, '', filtered_message, flags=re.IGNORECASE | re.DOTALL)
        
        # Clean up extra whitespace
        filtered_message = re.sub(r'\s+', ' ', filtered_message).strip()
        
        # Only remove sentences that are clearly technical (more conservative approach)
        sentences = filtered_message.split('.')
        clean_sentences = []
        
        # Only filter sentences that are clearly technical
        technical_phrases = [
            'calling function', 'using tool', 'executing', 'api call',
            'function call', 'tool execution', 'debug', 'error log'
        ]
        
        for sentence in sentences:
            sentence = sentence.strip()
            if sentence and len(sentence) > 3:  # Keep sentences with at least 3 characters
                # Only remove if sentence contains technical phrases
                if not any(phrase in sentence.lower() for phrase in technical_phrases):
                    clean_sentences.append(sentence)
        
        result = '. '.join(clean_sentences)
        
        # If filtering removed too much, return original message
        if len(result.strip()) < len(message.strip()) * 0.3:  # If less than 30% remains
            logger.warning(f"Response filtering too aggressive, returning original: '{message[:50]}...'")
            return message
        
        return result + ('.' if clean_sentences and not result.endswith('.') else '')
    
    
    async def _start_agent_session(self, context: JobContext):
        """Start the agent session using the proper VideoSDK pattern"""
        session = None
        room_id = context.room_options.room_id
        
        try:
            logger.info(f"🎯 Starting KYC Agent session for room {room_id}")
            
            # Create the KYC voice agent
            agent = KYCVoiceAgent()
            
            # Register workflow management tools
            @function_tool
            def get_current_workflow_step(room_id: str) -> Dict[str, Any]:
                """Get the current workflow step for the room"""
                current_step = workflow_service.get_current_step(room_id)
                if current_step:
                    return {
                        "step_id": current_step.id,
                        "title": current_step.title,
                        "description": current_step.description,
                        "type": current_step.type,
                        "status": current_step.status,
                        "instructions": current_step.instructions
                    }
                return {"error": "No current step found"}
            
            @function_tool
            def complete_workflow_step(room_id: str, step_id: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
                """Complete a workflow step with provided data"""
                result = workflow_service.complete_workflow_step(room_id, step_id, data)
                return result
            
            # Note: Tools are automatically available to the agent through the function_tool decorator
            # The LLM will have access to these tools during conversation
            logger.info("✅ Workflow management tools configured for agent")
            
            # Set up the pipeline components with proper error handling
            try:
                stt = SarvamAISTT(
                    api_key=self.settings.sarvamai_api_key,
                    model="saarika:v2",
                    language="en-IN"
                )
                logger.info("✅ STT initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize STT: {e}")
                raise
            
            try:
                tts = SarvamAITTS(
                    api_key=self.settings.sarvamai_api_key,
                    model="bulbul:v2",
                    speaker="anushka",
                    target_language_code="en-IN",
                    pitch=self.settings.tts_pitch,
                    pace=self.settings.tts_pace,  # Configurable pace for speech speed
                    loudness=self.settings.tts_loudness  # Configurable loudness
                )
                logger.info(f"✅ Sarvam AI TTS initialized successfully (pace: {self.settings.tts_pace}, pitch: {self.settings.tts_pitch}, loudness: {self.settings.tts_loudness})")
                
                # For True Sync, we need to disable the main agent's TTS audio
                # because the avatar participant will handle TTS internally
                if self.settings.avatar_implementation.lower() == "true_sync":
                    logger.info("🎬 True Sync mode: Main agent TTS audio will be disabled, avatar participant will handle TTS")
            except Exception as e:
                logger.error(f"❌ Failed to initialize TTS: {e}")
                raise
            
            try:
                llm = GoogleLLM(
                    api_key=self.settings.google_api_key,
                    model="gemini-2.0-flash-001",
                    temperature=0.3,  # Lower temperature for more consistent responses
                    tool_choice="auto",
                    max_output_tokens=500  # Reduced for faster responses
                )
                logger.info("✅ LLM initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize LLM: {e}")
                raise
            
            # Initialize VAD, Turn Detector, and Denoise with optimized settings for interruption handling
            # Lower thresholds for more sensitive voice detection and faster interruption handling
            vad = SileroVAD(threshold=0.1)  # Very low threshold for immediate voice detection
            turn_detector = TurnDetector(threshold=0.3)  # Lower threshold for faster turn detection
            denoise = RNNoise()
            
            # Initialize Wav2Lip avatar if enabled
            avatar = None
            if self.wav2lip_avatar:
                avatar = self.wav2lip_avatar
                logger.info("🎯 Wav2Lip avatar will be used in pipeline")
            
            # For True Sync, create a separate avatar agent participant
            if self.settings.avatar_implementation.lower() == "true_sync":
                # Create avatar agent as separate participant
                agent_token = context.room_options.auth_token
                avatar_created = await self._create_avatar_agent_for_room(room_id, agent_token)
                if avatar_created:
                    logger.info("🎬 Avatar agent created as separate participant")
                    # Disable main agent's TTS since Avatar Agent provides both audio and video
                    pipeline_tts = None
                else:
                    logger.warning("⚠️ Failed to create avatar agent, falling back to regular TTS")
                    pipeline_tts = tts
            else:
                pipeline_tts = tts
            
            # Create the custom cascading pipeline with all components
            pipeline = CustomCascadingPipeline(
                stt=stt,
                tts=pipeline_tts,  # Disabled for True Sync - avatar provides audio
                llm=llm,
                vad=vad,
                turn_detector=turn_detector,
                denoise=denoise,
                avatar=avatar
            )
            
            if self.settings.avatar_implementation.lower() == "true_sync":
                logger.info("🎬 True Sync mode: TTS audio will be routed through avatar for synchronization")
            
            # Create conversation flow for better conversation management
            conversation_flow = ConversationFlow(agent)
            
            # Create agent session with pipeline and conversation flow
            session = AgentSession(
                agent=agent, 
                pipeline=pipeline,
                conversation_flow=conversation_flow
            )
            
            # Set up conversation logging
            self._setup_conversation_logging(session, room_id)
            
            # Set up response filtering to prevent function calls from being spoken
            self._setup_response_filtering(session, room_id)
            
            # Store the session for cleanup
            self.agent_sessions[room_id] = session
            
            # Connect to the room first
            logger.info("🎯 Connecting to VideoSDK room...")
            try:
                await context.connect()
                logger.info("✅ Successfully connected to VideoSDK room")
            except Exception as e:
                logger.error(f"❌ Failed to connect to VideoSDK room: {e}")
                logger.error(f"Connection error details: {type(e).__name__}: {str(e)}")
                
                # Check if this is a media device related error
                if "device" in str(e).lower() or "webrtc" in str(e).lower():
                    logger.warning("🎯 This appears to be a media device related error - common in server environments")
                    logger.info("🎯 Agent will continue setup but may have limited functionality")
                elif "401" in str(e) or "unauthorized" in str(e).lower():
                    logger.error("🎯 Authentication error - check token validity and permissions")
                    raise  # Re-raise auth errors as they're critical
                elif "wav2lip" in str(e).lower() or "provide text or voice input" in str(e).lower():
                    logger.warning("🎯 Wav2Lip avatar connection failed - agent will continue without avatar")
                    logger.info("🎯 Agent will function normally but without lip-sync video")
                else:
                    logger.warning("🎯 Unknown connection error - continuing with agent setup")
                
                # Continue anyway - the agent might still be able to function
                logger.info("🎯 Continuing with agent setup despite connection error...")
            
            # Start the session
            logger.info("🎯 Starting agent session...")
            try:
                await session.start()
                logger.info("✅ Agent session started successfully")
            except Exception as e:
                logger.error(f"❌ Failed to start agent session: {e}")
                raise
            
            logger.info("🎯 KYC Agent session started successfully")
            
            # Avatar agent is now created during pipeline initialization for True Sync
            
            # Wav2Lip video track is now handled through the pipeline avatar integration
            # No manual publishing needed - VideoSDK handles it automatically
            
            # Send initial greeting
            try:
                greeting = "Hello! I am your KYC Virtual Assistant. I'm here to help you complete your identity verification process. Let's get started with a friendly conversation!"
                await session.say(greeting)
                logger.info("🎯 Initial greeting sent")
                
                # Also send greeting text to avatar for lip-sync
                if self.wav2lip_avatar or self.settings.avatar_implementation.lower() == "true_sync":
                    await self._send_text_to_avatar(greeting, room_id)
                        
            except Exception as e:
                logger.warning(f"Could not send initial greeting: {e}")
                # Try a simpler greeting as fallback
                try:
                    simple_greeting = "Hello! I'm your KYC assistant. How can I help you today?"
                    await session.say(simple_greeting)
                    logger.info("🎯 Simple greeting sent as fallback")
                    
                    # Also send simple greeting to avatar
                    if self.wav2lip_avatar or self.settings.avatar_implementation.lower() == "true_sync":
                        await self._send_text_to_avatar(simple_greeting, room_id)
                            
                except Exception as e2:
                    logger.warning(f"Could not send simple greeting either: {e2}")
                    # Continue anyway - the agent is still functional
            
            # Keep the session running until manually terminated
            try:
                await asyncio.Event().wait()
            except Exception as e:
                logger.error(f"❌ Session wait failed: {e}")
                raise
            
        except Exception as e:
            logger.error(f"❌ Agent session failed: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
        finally:
            # Clean up resources when done
            if session:
                try:
                    await session.close()
                    logger.info("🎯 Agent session closed")
                except Exception as e:
                    logger.error(f"Error closing agent session: {e}")
            
            # Remove from active sessions
            if room_id and room_id in self.agent_sessions:
                del self.agent_sessions[room_id]
            
            try:
                await context.shutdown()
                logger.info("🎯 Job context shutdown")
            except Exception as e:
                logger.error(f"Error shutting down job context: {e}")
    
    async def stop_agent(self, room_id: str) -> Dict[str, Any]:
        """Stop the agent for a specific room"""
        try:
            logger.info(f"🛑 Stopping agent for room {room_id}")
            logger.info(f"🛑 Active agents: {list(self.active_agents.keys())}")
            logger.info(f"🛑 Agent sessions: {list(self.agent_sessions.keys())}")
            logger.info(f"🛑 Agent jobs: {list(self.agent_jobs.keys())}")
            
            # Find the actual VideoSDK room ID from the session ID
            # The room_id parameter might be a session_id (customRoomId), we need to find the actual room_id
            actual_room_id = room_id
            for session_id, session_data in self.agent_sessions.items():
                # session_data is an AgentSession object, not a dict
                if session_id == room_id:
                    # For AgentSession objects, we need to get the room_id differently
                    # The room_id should be the same as session_id for our use case
                    actual_room_id = session_id
                    break
            
            logger.info(f"🛑 Using actual room ID: {actual_room_id} for session: {room_id}")
            
            # Always try to stop Wav2Lip avatar if enabled, regardless of agent tracking
            if self.wav2lip_avatar:
                try:
                    await self.wav2lip_avatar.disconnect()
                    logger.info(f"✅ Wav2Lip avatar disconnected for room {room_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to disconnect Wav2Lip avatar for room {room_id}: {e}")
            
                # Remove avatar agent if using true sync
                if self.settings.avatar_implementation.lower() == "true_sync":
                    logger.info(f"🛑 True Sync detected, removing avatar agent for room {actual_room_id}")
                    try:
                        success = await avatar_agent_service.remove_avatar_agent(actual_room_id)
                        if success:
                            logger.info(f"✅ Avatar agent removed for room {actual_room_id}")
                        else:
                            logger.warning(f"⚠️ Failed to remove avatar agent for room {actual_room_id}")
                    except Exception as e:
                        logger.warning(f"⚠️ Failed to remove avatar agent for room {actual_room_id}: {e}")
                        import traceback
                        logger.warning(f"⚠️ Traceback: {traceback.format_exc()}")
                else:
                    logger.info(f"ℹ️ Not using True Sync (using {self.settings.avatar_implementation}), skipping avatar agent removal")
            
            # Stop the agent session if it exists
            if room_id in self.agent_sessions:
                try:
                    await self.agent_sessions[room_id].stop()
                    del self.agent_sessions[room_id]
                    logger.info(f"✅ Agent session stopped for room {room_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to stop agent session for room {room_id}: {e}")
            
            # Stop the job if it exists
            if room_id in self.agent_jobs:
                try:
                    self.agent_jobs[room_id].stop()
                    del self.agent_jobs[room_id]
                    logger.info(f"✅ Agent job stopped for room {room_id}")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to stop agent job for room {room_id}: {e}")
            
            # Clean up tracking if it exists
            if room_id in self.active_agents:
                del self.active_agents[room_id]
                logger.info(f"✅ Agent tracking cleaned up for room {room_id}")
            
            logger.info(f"✅ Agent cleanup completed for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "message": "Agent stopped successfully"
            }
                
        except Exception as e:
            logger.error(f"❌ Failed to stop agent for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    def get_agent_status(self, room_id: str) -> Dict[str, Any]:
        """Get the status of an agent for a specific room"""
        if room_id in self.active_agents:
            return {
                "status": "success",
                "room_id": room_id,
                "agent_status": self.active_agents[room_id]["status"],
                "agent_participant_id": self.active_agents[room_id]["participant_id"]
            }
        else:
            return {
                "status": "error",
                "room_id": room_id,
                "error": "No agent found for this room"
            }
    
    def clear_agent_tracking(self, room_id: str) -> Dict[str, Any]:
        """Clear agent tracking for a specific room (useful for debugging)"""
        try:
            if room_id in self.active_agents:
                del self.active_agents[room_id]
                logger.info(f"✅ Cleared agent tracking for room {room_id}")
                return {
                    "status": "success",
                    "room_id": room_id,
                    "message": "Agent tracking cleared"
                }
            else:
                return {
                    "status": "error",
                    "room_id": room_id,
                    "error": "No agent tracking found for this room"
                }
        except Exception as e:
            logger.error(f"❌ Failed to clear agent tracking for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e)
            }
    
    

# Global instance
proper_agent_service = ProperAgentService()
