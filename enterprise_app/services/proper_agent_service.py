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
from typing import Dict, Any, List
from utils.settings import get_settings
from utils.logger import get_logger
from .conversation_logger import conversation_logger
from videosdk.agents import Agent, AgentSession, JobContext, RoomOptions, function_tool, ConversationFlow, WorkerJob, Options
from videosdk.agents import CascadingPipeline, RealTimePipeline, STT, TTS, LLM
from videosdk.plugins.sarvamai import SarvamAISTT, SarvamAITTS, SarvamAILLM
from videosdk.plugins.google import GoogleLLM, GoogleTTS, GeminiRealtime, GeminiLiveConfig
from videosdk.plugins.silero import SileroVAD
from videosdk.plugins.turn_detector import TurnDetector, pre_download_model
from videosdk.plugins.rnnoise import RNNoise
from videosdk.plugins.simli import SimliAvatar, SimliConfig  # VideoSDK docs: https://docs.videosdk.live/ai_agents/plugins/avatar/simli

logger = get_logger(__name__)

class KYCVoiceAgent(Agent):
    """
    KYC Voice Agent that helps with identity verification process using voice interaction
    """
    
    def __init__(self, workflow_json: str = ""):
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
        - You have access to the current workflow configuration
        - Guide the user through each step based on the workflow
        - When a step is completed, use complete_workflow_step(room_id, step_id, data) to mark it as done
        - Provide clear instructions for each step type:
          * FACE_CAPTURE: Guide user to take a clear selfie
          * DOCUMENT_CAPTURE: Help user capture their ID document
          * QUESTIONNAIRE: Ask the required questions and collect answers
          * verification: Confirm completion and next steps
        
        IMPORTANT INTERRUPTION HANDLING:
        - Always listen for user interruptions while speaking
        - If the user starts speaking while you're talking, immediately stop and listen
        - Wait for the user to finish speaking before responding
        - Acknowledge their interruption politely (e.g., "I understand, please go ahead")
        - Be responsive to user questions and concerns at any time
        
        CRITICAL SPEECH RULES:
        - NEVER include tool_code, function calls, or technical details in your speech
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
        
        # Store workflow data
        self.workflow_json = workflow_json
        self.workflow_data = None
        self.current_step_index = 0
        self.completed_steps = []
        
        # Parse workflow if provided
        if workflow_json:
            try:
                import json
                self.workflow_data = json.loads(workflow_json)
                logger.info("🎯 Workflow data loaded successfully")
            except Exception as e:
                logger.error(f"❌ Failed to parse workflow JSON: {e}")
    
    async def on_enter(self) -> None:
        """Called when the agent enters the meeting"""
        logger.info("🎯 KYC Voice Agent entered the meeting")
        
        # Get the first in-call step to start with
        first_step = self.get_current_step()
        if first_step:
            greeting = self.generate_step_greeting(first_step)
            await self.session.say(greeting)
            logger.info(f"🎯 Step-specific greeting sent for: {first_step.get('title', 'Unknown')}")
        else:
            # Fallback to generic greeting
            await self.session.say("Hello! I am your KYC Virtual Assistant. I'm here to help you complete your identity verification process.")
    
    def get_current_step(self):
        """Get the current step from workflow"""
        if not self.workflow_data or not self.workflow_data.get('actionables'):
            return None
        
        # Get in-call steps (sub_action_step: "in_call" or not specified for main flow)
        in_call_steps = []
        for actionable in self.workflow_data['actionables']:
            if actionable.get('sub_actions'):
                for sub_action in actionable['sub_actions']:
                    # Include steps that are not explicitly marked as "pre"
                    if sub_action.get('sub_action_step') != 'pre':
                        in_call_steps.append(sub_action)
        
        if self.current_step_index < len(in_call_steps):
            return in_call_steps[self.current_step_index]
        return None
    
    def generate_step_greeting(self, step):
        """Generate a greeting specific to the current step"""
        step_type = step.get('type', '')
        step_title = step.get('title', '')
        step_description = step.get('description', '')
        
        if step_type == 'FRAME_CAPTURE':
            if step.get('frame_capture_type') == 'FACE_CAPTURE':
                return f"Hello! I'm your KYC assistant. Let's start with {step_title}. {step_description} Please position your face in the camera frame and click the capture button when ready."
            elif step.get('frame_capture_type') == 'DOCUMENT_CAPTURE':
                return f"Great! Now let's capture your {step_title}. {step_description} Please position your document in the camera frame and click the capture button when ready."
        elif step_type == 'QUESTIONNAIRE':
            return f"Excellent! Now I have a few questions for you. {step_description} Please answer each question clearly."
        
        return f"Hello! Let's proceed with {step_title}. {step_description}"
    
    def get_function_tools(self):
        """Return function tools for the agent"""
        return [
            {
                "type": "function",
                "function": {
                    "name": "complete_step",
                    "description": "Mark the current step as completed and move to the next step",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "step_id": {
                                "type": "string",
                                "description": "The ID of the completed step"
                            },
                            "result": {
                                "type": "string", 
                                "description": "The result of the step completion"
                            }
                        },
                        "required": ["step_id", "result"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_next_step_instruction",
                    "description": "Get instructions for the next step in the workflow",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }
        ]
    
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
        self._session_events: Dict[str, asyncio.Event] = {}
        self._job_contexts: Dict[str, JobContext] = {}
        
        # Thread lock to prevent race conditions
        self._agent_start_lock = threading.Lock()
        
        # Pre-download the Turn Detector model
        try:
            pre_download_model()
            logger.info("✅ Turn Detector model pre-downloaded successfully")
        except Exception as e:
            logger.warning("Failed to pre-download Turn Detector model", extra={"error": str(e)})
        
        # Start periodic cleanup task
        self._start_periodic_cleanup()
    
    def _start_periodic_cleanup(self):
        """Start a periodic cleanup task to prevent Simli sessions from running indefinitely"""
        import threading
        
        def cleanup_worker():
            import time
            while True:
                try:
                    time.sleep(30)  # Check every 30 seconds
                    # Check for any sessions that should be cleaned up
                    current_time = time.time()
                    for room_id in list(self.active_agents.keys()):
                        agent_info = self.active_agents.get(room_id, {})
                        if agent_info.get("status") == "stopped":
                            logger.info(f"🧹 Periodic cleanup: Removing stopped agent for room {room_id}")
                            try:
                                # Force cleanup of stopped agents
                                if room_id in self.agent_sessions:
                                    del self.agent_sessions[room_id]
                                if room_id in self._session_events:
                                    del self._session_events[room_id]
                                if room_id in self._job_contexts:
                                    del self._job_contexts[room_id]
                                if room_id in self.agent_jobs:
                                    del self.agent_jobs[room_id]
                                del self.active_agents[room_id]
                            except Exception as e:
                                logger.error(f"❌ Error in periodic cleanup for room {room_id}: {e}")
                except Exception as e:
                    logger.error(f"❌ Error in periodic cleanup worker: {e}")
                    time.sleep(60)  # Wait longer on error
        
        cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
        cleanup_thread.start()
        logger.info("🧹 Periodic cleanup task started")
    
    def _create_pipeline(self, pipeline_kwargs: Dict[str, Any], simli_avatar: Any = None):
        """
        Create the appropriate pipeline based on configuration.
        
        Args:
            pipeline_kwargs: Dictionary of pipeline components
            simli_avatar: Simli avatar instance (if available)
            
        Returns:
            Pipeline instance (CascadingPipeline or RealTimePipeline)
        """
        pipeline_type = self.settings.pipeline_type.lower()
        
        logger.info(f"🔧 Pipeline configuration: {pipeline_type}")
        
        if pipeline_type == "realtime":
            logger.info("🚀 Creating RealTimePipeline with Google Gemini LiveAPI for ultra-low latency")
            logger.info("📋 RealTimePipeline benefits: Direct audio processing, no intermediate steps, sub-second response times")
            return self._create_realtime_pipeline(simli_avatar)
        else:
            logger.info("🔄 Creating CascadingPipeline with traditional components")
            logger.info("📋 CascadingPipeline: STT → LLM → TTS → Avatar pipeline")
            return self._create_cascading_pipeline(pipeline_kwargs)
    
    def _create_realtime_pipeline(self, simli_avatar: Any = None):
        """
        Create a RealTimePipeline using Google Gemini LiveAPI for ultra-low latency.
        
        Args:
            simli_avatar: Simli avatar instance (if available)
        
        Returns:
            RealTimePipeline instance
        """
        try:
            # Validate Google API key
            if not self.settings.google_api_key:
                raise ValueError("Google API key is required for RealTimePipeline")
            
            logger.info("🔑 Using Google API key for RealTimePipeline")
            
            # Use provided Simli Avatar or initialize if not provided
            if simli_avatar is None and self.settings.simli_api_key and self.settings.simli_avatar_id:
                try:
                    simli_config = SimliConfig(
                        apiKey=self.settings.simli_api_key,
                        faceId=self.settings.simli_avatar_id,
                    )
                    simli_avatar = SimliAvatar(config=simli_config)
                    logger.info("🎭 Simli Avatar initialized for RealTimePipeline")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to initialize Simli Avatar for RealTimePipeline: {e}")
                    logger.info("🎭 Continuing with voice-only RealTimePipeline")
                    simli_avatar = None
            
            # Initialize Google Gemini Realtime model with Indian English
            model = GeminiRealtime(
                model="gemini-2.0-flash-live-001",
                api_key=self.settings.google_api_key,
                config=GeminiLiveConfig(
                    voice="Leda",  # Natural-sounding voice  #Orus for male Leda for female
                    response_modalities=["AUDIO"],  # Audio-only for faster processing
                    temperature=0.1,  # Low temperature for consistent responses
                    max_output_tokens=200,  # Shorter responses for faster generation
                    language_code="en-IN"  # Indian English for better accent
                )
            )
            
            # Create RealTimePipeline with avatar if available
            if simli_avatar:
                pipeline = RealTimePipeline(model=model, avatar=simli_avatar)
                logger.info("✅ RealTimePipeline created successfully with Google Gemini LiveAPI and Simli Avatar")
                logger.info("🎭 Avatar will provide visual feedback during conversation")
            else:
                pipeline = RealTimePipeline(model=model)
                logger.info("✅ RealTimePipeline created successfully with Google Gemini LiveAPI (voice-only)")
            
            logger.info("⚡ Expected latency: Sub-second response times")
            logger.info("🇮🇳 Using Indian English (en-IN) for better accent")
            return pipeline
            
        except Exception as e:
            logger.error(f"❌ Failed to create RealTimePipeline: {e}")
            logger.error("💡 Make sure you have:")
            logger.error("   - Valid GOOGLE_API_KEY in your .env file")
            logger.error("   - videosdk-plugins-google package installed")
            logger.error("   - Internet connection for Google API access")
            logger.info("🔄 Falling back to CascadingPipeline...")
            # Fallback to cascading pipeline if realtime fails
            return None
    
    def _create_cascading_pipeline(self, pipeline_kwargs: Dict[str, Any]):
        """
        Create a CascadingPipeline with traditional components.
        
        Args:
            pipeline_kwargs: Dictionary of pipeline components
            
        Returns:
            CascadingPipeline instance
        """
        try:
            pipeline = CascadingPipeline(**pipeline_kwargs)
            logger.info("✅ CascadingPipeline created successfully")
            return pipeline
        except Exception as e:
            logger.error(f"❌ Failed to create CascadingPipeline: {e}")
            raise
    
    async def join_agent_to_room(
        self, 
        room_id: str, 
        agent_participant_id: str, 
        agent_token: str,
        workflow_json: str = ""
    ) -> Dict[str, Any]:
        logger.info(f"🎯 JOIN-AGENT: Starting agent join for room_id: {room_id}")
        logger.info(f"🎯 JOIN-AGENT: Agent participant ID: {agent_participant_id}")
        logger.info(f"🎯 JOIN-AGENT: Current active agents: {list(self.active_agents.keys())}")
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
                    # workflow_service.load_workflow(room_id, workflow_json)
                    pass
                else:
                    # workflow_service.load_workflow(room_id)
                    pass
                
                # Store the original token if it exists
                original_token = os.environ.get("VIDEOSDK_AUTH_TOKEN")
                
                # Set the auth token for this specific job
                os.environ["VIDEOSDK_AUTH_TOKEN"] = agent_token
                logger.info(f"✅ Set VIDEOSDK_AUTH_TOKEN for room {room_id}")
                
                try:
                    # Create the worker job using the proper VideoSDK pattern
                    options = Options(register=False)
                    job_context = self._make_job_context(room_id, agent_token)
                    # Create a proper coroutine function for the entrypoint
                    async def agent_entrypoint(ctx: JobContext):
                        return await self._start_agent_session(ctx, workflow_json)
                    
                    job = WorkerJob(
                        entrypoint=agent_entrypoint,
                        jobctx=job_context,
                        options=options
                    )
                    
                    # Store the job and context for proper cleanup
                    self.agent_jobs[room_id] = job
                    self._job_contexts[room_id] = job_context
                    
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
                import traceback
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
            playground=False  # Set to False for production use
        )
        
        return JobContext(room_options=room_options)
    
    def _setup_conversation_logging(self, session: AgentSession, room_id: str):
        """Set up conversation logging for the agent session"""
        try:
            # Override the session's say method to log TTS input
            original_say = session.say
            
            async def logged_say(message: str, **kwargs):
                turn_id = conversation_logger.start_conversation_turn(room_id)
                conversation_logger.log_tts_input(room_id, message, **kwargs)
                logger.info(f"🔊 AGENT SAYING: '{message[:100]}{'...' if len(message) > 100 else ''}'")
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
                    try:
                        return await original_say(filtered_message, **kwargs)
                    except Exception as e:
                        error_str = str(e).lower()
                        if "audio track" in error_str or "loop not initialized" in error_str:
                            logger.warning("🎯 Audio track error - this is normal in voice-only mode")
                            logger.info("🎯 Agent is functional but audio output may not work")
                            return None
                        else:
                            logger.error(f"❌ TTS failed for filtered message: {e}")
                            # Fallback: try with original message if filtered version fails
                            if filtered_message != message:
                                logger.info("🔄 FALLBACK: Trying with original message")
                                try:
                                    return await original_say(message, **kwargs)
                                except Exception as e2:
                                    error_str2 = str(e2).lower()
                                    if "audio track" in error_str2 or "loop not initialized" in error_str2:
                                        logger.warning("🎯 Audio track error in fallback - continuing without audio")
                                        return None
                                    else:
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
    
    def _filter_function_calls(self, message: str) -> str:
        """Filter out function calls and technical details from the message"""
        import re
        
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
    
    
    async def _start_agent_session(self, context: JobContext, workflow_json: str = ""):
        """Start the agent session using the proper VideoSDK pattern"""
        session = None
        room_id = context.room_options.room_id
        
        try:
            logger.info(f"🎯 Starting KYC Agent session for room {room_id}")
            
            # Create the KYC voice agent with workflow data
            agent = KYCVoiceAgent(workflow_json=workflow_json)
            
            # Register workflow management tools
            @function_tool
            def get_current_workflow_step(room_id: str) -> Dict[str, Any]:
                """Get the current workflow step for the room"""
                current_step = agent.get_current_step()
                if current_step:
                    return {
                        "status": "success",
                        "current_step": current_step.get('type', 'unknown'),
                        "step_title": current_step.get('title', ''),
                        "step_description": current_step.get('description', ''),
                        "step_id": current_step.get('sub_action_ref', ''),
                        "frame_capture_type": current_step.get('frame_capture_type', '')
                    }
                return {
                    "status": "success",
                    "current_step": "completed",
                    "message": "All workflow steps completed"
                }
            
            @function_tool
            def complete_workflow_step(room_id: str, step_id: str, data: Dict[str, Any] | None = None) -> Dict[str, Any]:
                """Complete a workflow step and move to the next one"""
                logger.info(f"🎯 Workflow step completed: {step_id} for room {room_id}")
                
                # Mark current step as completed
                agent.completed_steps.append(step_id)
                agent.current_step_index += 1
                
                # Get next step
                next_step = agent.get_current_step()
                if next_step:
                    next_instruction = agent.generate_step_greeting(next_step)
                    return {
                        "status": "success",
                        "message": f"Step {step_id} completed successfully",
                        "next_step": next_step.get('type', 'unknown'),
                        "next_step_title": next_step.get('title', ''),
                        "next_instruction": next_instruction
                    }
                else:
                    return {
                        "status": "success",
                        "message": f"Step {step_id} completed successfully",
                        "next_step": "completed",
                        "message": "All workflow steps completed"
                    }
            
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
                # Use Sarvam AI TTS as primary (more reliable for this setup)
                tts = SarvamAITTS(
                    api_key=self.settings.sarvamai_api_key,
                    model="bulbul:v2",
                    speaker="anushka",
                    target_language_code="en-IN",
                    pitch=0.0,
                    pace=1.0,  # Reduced from 1.2 to 1.0 for more natural speech timing
                    loudness=1.0  # Reduced from 1.2 to 1.0 for better audio quality
                )
                logger.info("✅ Sarvam AI TTS initialized successfully")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Sarvam AI TTS: {e}")
                # Fallback to Google TTS if Sarvam AI TTS fails
                try:
                    logger.info("🔄 Falling back to Google TTS...")
                    tts = GoogleTTS(
                        api_key=self.settings.google_api_key
                        # Remove voice and speed parameters that are causing errors
                    )
                    logger.info("✅ Google TTS initialized successfully as fallback")
                except Exception as e2:
                    logger.error(f"❌ Failed to initialize Google TTS fallback: {e2}")
                    raise Exception(f"Both TTS providers failed: Sarvam AI ({e}), Google ({e2})")
            
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
            
            # Initialize Simli Avatar following working repository pattern
            simli_avatar = None
            simli_api_key = self.settings.simli_api_key
            simli_avatar_id = self.settings.simli_avatar_id
            logger.info(f"🎭 Using default Simli avatar ID: {simli_api_key}, {simli_avatar_id}")
            # Check if we have a valid Simli API key
            simli_config = SimliConfig(
                apiKey=simli_api_key,
                faceId=simli_avatar_id,
            )

            # 2. Create a SimliAvatar instance
            simli_avatar = SimliAvatar(config=simli_config)

            # Create the cascading pipeline (following working repository pattern)
            pipeline_kwargs = {
                "stt": stt,
                "tts": tts,
                "llm": llm,
                "vad": vad,
                "turn_detector": turn_detector,
                "denoise": denoise
            }
            
            # Add avatar to pipeline if available
            if simli_avatar is not None:
                pipeline_kwargs["avatar"] = simli_avatar
                logger.info("🎭 Avatar included in pipeline")
            else:
                logger.info("🎭 No avatar - voice-only pipeline")
            
            # Create pipeline based on configuration
            pipeline = self._create_pipeline(pipeline_kwargs, simli_avatar)
            
            # Handle fallback if RealTimePipeline fails
            if pipeline is None:
                logger.warning("⚠️ RealTimePipeline failed, falling back to CascadingPipeline")
                pipeline = self._create_cascading_pipeline(pipeline_kwargs)
            
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
                
                # Check for specific error types
                error_str = str(e).lower()
                if "device" in error_str or "webrtc" in error_str:
                    logger.warning("🎯 This appears to be a media device related error - common in server environments")
                    logger.info("🎯 Agent will continue setup but may have limited functionality")
                elif "401" in error_str or "unauthorized" in error_str:
                    logger.error("🎯 Authentication error - check token validity and permissions")
                    raise  # Re-raise auth errors as they're critical
                elif "422" in error_str and "simli" in error_str:
                    logger.warning("🎯 Simli Avatar connection error - this is expected if no valid API key is provided")
                    logger.info("🎯 Agent will continue in voice-only mode")
                elif "simli" in error_str:
                    logger.warning("🎯 Simli Avatar connection error - continuing without avatar")
                    logger.info("🎯 Agent will continue in voice-only mode")
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
            
            # Set up participant event handlers for proper cleanup
            try:
                # Get the room from the context to set up event handlers
                room = context.room
                if room:
                    # Handle participant left events
                    def on_participant_left(participant):
                        logger.info(f"🎯 Participant left: {participant.name if hasattr(participant, 'name') else 'Unknown'}")
                        # Trigger cleanup when all non-agent participants leave
                        if room.participants and len(room.participants) <= 1:  # Only agent left
                            logger.info("🎯 All participants left, triggering agent cleanup...")
                            # Trigger the session event to end the session
                            if room_id in self._session_events:
                                self._session_events[room_id].set()
                    
                    # Register the event handler
                    room.on('participant-left', on_participant_left)
                    logger.info("✅ Participant event handlers set up")
                else:
                    logger.warning("⚠️ No room found in context, cannot set up participant event handlers")
            except Exception as e:
                logger.warning(f"⚠️ Failed to set up participant event handlers: {e}")
                # Continue anyway - the session will still work
            
            logger.info("🎯 KYC Agent session started successfully")
            
            # Note: Initial greeting is now handled by the agent's on_enter method
            logger.info("🎯 Agent will handle initial greeting in on_enter method")
            
            # Keep the session running until manually terminated
            # Use a proper event loop that can be cancelled
            try:
                # Create a cancellation event that can be triggered from outside
                self._session_events[room_id] = asyncio.Event()
                
                # Add a timeout to prevent sessions from running indefinitely
                try:
                    await asyncio.wait_for(self._session_events[room_id].wait(), timeout=3600)  # 1 hour timeout
                    logger.info(f"🎯 Session event triggered for room {room_id}")
                except asyncio.TimeoutError:
                    logger.warning(f"⏰ Session timeout reached for room {room_id}, cleaning up...")
                    # Force cleanup on timeout
                    if room_id in self.agent_sessions:
                        try:
                            await self.agent_sessions[room_id].close()
                            logger.info(f"✅ Session closed due to timeout for room {room_id}")
                        except Exception as e:
                            logger.error(f"❌ Error closing session on timeout for room {room_id}: {e}")
                    
            except asyncio.CancelledError:
                logger.info(f"🎯 Session cancelled for room {room_id}")
            except Exception as e:
                logger.error(f"❌ Session wait failed: {e}")
                raise
            
        except Exception as e:
            logger.error(f"❌ Agent session failed: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
        finally:
            # Clean up resources when done
            if session:
                try:
                    logger.info(f"🎭 Closing Simli avatar session for room {room_id}...")
                    await session.close()
                    logger.info("🎯 Agent session closed")
                except Exception as e:
                    logger.error(f"Error closing agent session: {e}")
            
            # Remove from active sessions
            if room_id and room_id in self.agent_sessions:
                del self.agent_sessions[room_id]
            
            # Clean up session events
            if room_id and room_id in self._session_events:
                del self._session_events[room_id]
            
            # Clean up job context
            if room_id and room_id in self._job_contexts:
                del self._job_contexts[room_id]
            
            # Update active agents status
            if room_id in self.active_agents:
                self.active_agents[room_id]["status"] = "stopped"
            
            try:
                await context.shutdown()
                logger.info("🎯 Job context shutdown")
            except Exception as e:
                logger.error(f"Error shutting down job context: {e}")
    
    async def stop_agent(self, room_id: str) -> Dict[str, Any]:
        """Stop the agent for a specific room and clean up Simli avatar session"""
        try:
            logger.info(f"🛑 Stopping agent for room {room_id}...")
            logger.info(f"🔍 Active agents: {list(self.active_agents.keys())}")
            logger.info(f"🔍 Agent sessions: {list(self.agent_sessions.keys())}")
            logger.info(f"🔍 Job contexts: {list(self._job_contexts.keys())}")
            
            # Check if agent is active
            if room_id not in self.active_agents:
                logger.warning(f"⚠️ No active agent found for room {room_id}")
                # Check if there are any remaining resources to clean up
                cleanup_performed = False
                
                # Clean up any remaining session resources
                if room_id in self.agent_sessions:
                    logger.info(f"🧹 Cleaning up remaining session resources for room {room_id}")
                    try:
                        await self.agent_sessions[room_id].close()
                        del self.agent_sessions[room_id]
                        cleanup_performed = True
                    except Exception as e:
                        logger.error(f"❌ Error cleaning up session resources: {e}")
                
                # Clean up any remaining job context
                if room_id in self._job_contexts:
                    logger.info(f"🧹 Cleaning up remaining job context for room {room_id}")
                    try:
                        await self._job_contexts[room_id].shutdown()
                        del self._job_contexts[room_id]
                        cleanup_performed = True
                    except Exception as e:
                        logger.error(f"❌ Error cleaning up job context: {e}")
                
                # Clean up any remaining session events
                if room_id in self._session_events:
                    del self._session_events[room_id]
                    cleanup_performed = True
                
                return {
                    "status": "success" if cleanup_performed else "warning",
                    "room_id": room_id,
                    "message": "Agent was already stopped, but performed cleanup" if cleanup_performed else "No active agent found and no cleanup needed",
                    "agent_stopped": cleanup_performed
                }
            
            # Trigger session termination first
            if room_id in self._session_events:
                logger.info(f"🎯 Triggering session termination for room {room_id}...")
                self._session_events[room_id].set()
                del self._session_events[room_id]
            
            # Stop the agent session (this will close the Simli avatar session)
            if room_id in self.agent_sessions:
                logger.info(f"🎭 Closing Simli avatar session for room {room_id}...")
                try:
                    # First try to close the session properly
                    await self.agent_sessions[room_id].close()
                    logger.info(f"✅ Simli avatar session closed for room {room_id}")
                except Exception as e:
                    logger.error(f"❌ Error closing Simli avatar session for room {room_id}: {e}")
                    # If close() fails, try to force stop the session
                    try:
                        logger.info(f"🔄 Attempting force stop for room {room_id}...")
                        # Force stop by setting the session to stopped state
                        if hasattr(self.agent_sessions[room_id], '_stopping'):
                            self.agent_sessions[room_id]._stopping = True
                        if hasattr(self.agent_sessions[room_id], 'run'):
                            self.agent_sessions[room_id].run = False
                        logger.info(f"✅ Force stop completed for room {room_id}")
                    except Exception as force_error:
                        logger.error(f"❌ Force stop also failed for room {room_id}: {force_error}")
                finally:
                    del self.agent_sessions[room_id]
            else:
                logger.info(f"ℹ️ Simli avatar session already cleaned up for room {room_id}")
            
            # Stop the job
            if room_id in self.agent_jobs:
                logger.info(f"🔄 Stopping agent job for room {room_id}...")
                try:
                    self.agent_jobs[room_id].stop()
                    logger.info(f"✅ Agent job stopped for room {room_id}")
                except Exception as e:
                    logger.error(f"❌ Error stopping agent job for room {room_id}: {e}")
                finally:
                    del self.agent_jobs[room_id]
            else:
                logger.info(f"ℹ️ Agent job already cleaned up for room {room_id}")
            
            # Shutdown the job context
            if room_id in self._job_contexts:
                logger.info(f"🔄 Shutting down job context for room {room_id}...")
                try:
                    await self._job_contexts[room_id].shutdown()
                    logger.info(f"✅ Job context shutdown for room {room_id}")
                except Exception as e:
                    logger.error(f"❌ Error shutting down job context for room {room_id}: {e}")
                finally:
                    del self._job_contexts[room_id]
            else:
                logger.info(f"ℹ️ Job context already cleaned up for room {room_id}")
            
            # Clean up tracking
            del self.active_agents[room_id]
            
            logger.info(f"✅ Agent completely stopped for room {room_id}")
            return {
                "status": "success",
                "room_id": room_id,
                "message": "Agent stopped successfully and Simli avatar session closed",
                "agent_stopped": True
            }
                
        except Exception as e:
            logger.error(f"❌ Failed to stop agent for room {room_id}: {e}")
            return {
                "status": "error",
                "room_id": room_id,
                "error": str(e),
                "agent_stopped": False
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
    
    async def stop_all_agents(self) -> Dict[str, Any]:
        """Stop all active agents (useful for cleanup)"""
        try:
            stopped_agents = []
            failed_agents = []
            
            # Get a copy of active agents to avoid modification during iteration
            active_rooms = list(self.active_agents.keys())
            
            for room_id in active_rooms:
                try:
                    result = await self.stop_agent(room_id)
                    if result["status"] == "success":
                        stopped_agents.append(room_id)
                    else:
                        failed_agents.append({"room_id": room_id, "error": result.get("error", "Unknown error")})
                except Exception as e:
                    failed_agents.append({"room_id": room_id, "error": str(e)})
            
            logger.info(f"🛑 Stopped {len(stopped_agents)} agents, {len(failed_agents)} failed")
            
            return {
                "status": "success",
                "stopped_agents": stopped_agents,
                "failed_agents": failed_agents,
                "message": f"Stopped {len(stopped_agents)} agents, {len(failed_agents)} failed"
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to stop all agents: {e}")
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def force_cleanup_all_agents(self) -> Dict[str, Any]:
        """Force cleanup of all active agents and Simli sessions"""
        try:
            logger.info("🧹 Force cleaning up all active agents...")
            
            cleanup_results = {}
            
            # Get all active room IDs
            active_rooms = list(self.active_agents.keys())
            
            for room_id in active_rooms:
                try:
                    result = await self.stop_agent(room_id)
                    cleanup_results[room_id] = result
                except Exception as e:
                    logger.error(f"❌ Failed to cleanup agent for room {room_id}: {e}")
                    cleanup_results[room_id] = {
                        "status": "error",
                        "error": str(e)
                    }
            
            # Force cleanup any remaining sessions
            remaining_sessions = list(self.agent_sessions.keys())
            for room_id in remaining_sessions:
                try:
                    logger.info(f"🧹 Force closing remaining Simli session for room {room_id}")
                    # Try to close properly first
                    await self.agent_sessions[room_id].close()
                    del self.agent_sessions[room_id]
                except Exception as e:
                    logger.error(f"❌ Failed to force close Simli session for room {room_id}: {e}")
                    # Force stop by setting internal flags
                    try:
                        if hasattr(self.agent_sessions[room_id], '_stopping'):
                            self.agent_sessions[room_id]._stopping = True
                        if hasattr(self.agent_sessions[room_id], 'run'):
                            self.agent_sessions[room_id].run = False
                        logger.info(f"✅ Force stop flags set for room {room_id}")
                    except Exception as force_error:
                        logger.error(f"❌ Force stop flags failed for room {room_id}: {force_error}")
                    finally:
                        del self.agent_sessions[room_id]
            
            # Force cleanup any remaining session events
            remaining_events = list(self._session_events.keys())
            for room_id in remaining_events:
                try:
                    logger.info(f"🧹 Force triggering remaining session event for room {room_id}")
                    self._session_events[room_id].set()
                    del self._session_events[room_id]
                except Exception as e:
                    logger.error(f"❌ Failed to force trigger session event for room {room_id}: {e}")
            
            # Force cleanup any remaining jobs
            remaining_jobs = list(self.agent_jobs.keys())
            for room_id in remaining_jobs:
                try:
                    logger.info(f"🧹 Force stopping remaining job for room {room_id}")
                    self.agent_jobs[room_id].stop()
                    del self.agent_jobs[room_id]
                except Exception as e:
                    logger.error(f"❌ Failed to force stop job for room {room_id}: {e}")
            
            # Force cleanup any remaining job contexts
            remaining_contexts = list(self._job_contexts.keys())
            for room_id in remaining_contexts:
                try:
                    logger.info(f"🧹 Force shutting down remaining job context for room {room_id}")
                    await self._job_contexts[room_id].shutdown()
                    del self._job_contexts[room_id]
                except Exception as e:
                    logger.error(f"❌ Failed to force shutdown job context for room {room_id}: {e}")
            
            logger.info("✅ Force cleanup completed")
            return {
                "status": "success",
                "message": "All agents force cleaned up",
                "cleanup_results": cleanup_results
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to force cleanup all agents: {e}")
            return {
                "status": "error",
                "error": str(e)
            }

# Global instance
proper_agent_service = ProperAgentService()
