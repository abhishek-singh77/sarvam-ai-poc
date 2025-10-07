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

# Import patched Simli plugin with rate-limited logging
try:
    from patches.simli_patch import SimliAvatar, SimliConfig
    USE_PATCHED_SIMLI = True
    logger.info("🎭 Using patched Simli plugin with rate-limited logging")
except ImportError:
    from videosdk.plugins.simli import SimliAvatar, SimliConfig
    USE_PATCHED_SIMLI = False
    logger.info("🎭 Using standard Simli plugin")

# Re-enable Simli with proper implementation
DISABLE_SIMLI = False
if not DISABLE_SIMLI:
    logger.info("🎭 Simli Avatar enabled with proper implementation")

class KYCVoiceAgent(Agent):
    """
    KYC Voice Agent that helps with identity verification process using voice interaction
    """
    
    def __init__(self, workflow_json: str = ""):
        # Initialize workflow data first
        self.workflow_json = workflow_json
        self.workflow_data = None
        self.current_step_index = 0
        self.completed_steps = []
        self.session_ended = False
        
        # Initialize workflow data
        logger.info("🎯 AGENT: Initializing KYC Voice Agent")
        self.workflow_data = self._get_hardcoded_workflow()
        logger.info("🎯 AGENT: Workflow data loaded successfully")
        
        # Get workflow steps for context
        workflow_steps = self.get_all_in_call_steps()
        
        # Create instructions with workflow context
        instructions = self._create_instructions_with_workflow_context(workflow_steps)
        
        # Log the workflow context for debugging
        logger.info(f"🎯 AGENT: Created instructions with {len(workflow_steps)} workflow steps")
        for i, step in enumerate(workflow_steps, 1):
            step_title = step.get('title', f'Step {i}')
            step_type = step.get('type', 'Unknown')
            logger.info(f"🎯 AGENT:   Step {i}: {step_title} ({step_type})")
        
        super().__init__(
            instructions=instructions,
            agent_id="kyc-voice-agent"
        )
    
    def _create_instructions_with_workflow_context(self, workflow_steps: list) -> str:
        """Create agent instructions with workflow context"""
        try:
            # Base instructions with explicit welcome message
            base_instructions = """
        You are a professional KYC (Know Your Customer) Voice Assistant. Your role is to guide users through a smooth identity verification process using natural conversation.

        IMPORTANT: When you first start, you MUST begin with this exact greeting: "Hello! I'm your KYC assistant. Welcome to your identity verification session. I'll guide you through a few simple steps to complete your verification. We'll start by asking you a few verification questions, then take a clear photo of your face, and finally capture your identity documents. Please ensure you have good lighting and your documents ready. Let's begin with the first step."

        CORE RESPONSIBILITIES:
        1. Guide users through each verification step conversationally
        2. Help users capture clear photos of their face and documents
        3. Ask questions naturally and listen to user responses
        4. Provide helpful feedback and guidance throughout the process
        5. Be patient, friendly, and professional at all times

        CONVERSATION STYLE:
        - Speak naturally and conversationally, like a helpful assistant
        - Use simple, clear language that anyone can understand
        - Be encouraging and supportive throughout the process
        - Ask one question at a time and wait for responses
        - Acknowledge user responses positively
        - If users seem confused, offer to explain or repeat instructions

        INTERRUPTION HANDLING:
        - Always listen for user interruptions while speaking
        - If user starts speaking, immediately stop and listen
        - Wait for user to finish before responding
        - Acknowledge interruptions politely: "I understand, please go ahead"
        - Be responsive to questions and concerns at any time

        IMPORTANT SPEECH RULES:
        - NEVER mention technical details, function calls, or system operations
        - NEVER say things like "complete_workflow_step" or show function names
        - NEVER include URLs, error codes, or technical jargon
        - Keep speech natural, conversational, and user-friendly
        - Only speak what the user needs to hear
        - Your responses should be conversational, not technical

        Always be helpful, patient, and professional. Guide users through each step clearly and provide encouragement throughout the process.

        IMPORTANT: When users say they are "done" or "finished" with a step, you must verify that they have actually completed the required action (like taking a photo or answering questions) before moving to the next step. If they haven't completed the action, politely ask them to complete it first.
        """
            
            # Add workflow context if steps are available
            if workflow_steps:
                workflow_context = "\n\n        WORKFLOW CONTEXT:\n"
                workflow_context += f"        You will guide the user through {len(workflow_steps)} verification steps:\n\n"
                
                for i, step in enumerate(workflow_steps, 1):
                    step_type = step.get('type', 'Unknown')
                    step_title = step.get('title', f'Step {i}')
                    step_description = step.get('description', '')
                    
                    workflow_context += f"        Step {i}: {step_title}\n"
                    workflow_context += f"        - Type: {step_type}\n"
                    
                    if step_type == 'FRAME_CAPTURE':
                        capture_type = step.get('frame_capture_type', 'Unknown')
                        workflow_context += f"        - Capture Type: {capture_type}\n"
                        if capture_type == 'FACE_CAPTURE':
                            workflow_context += f"        - Instructions: Guide user to take a clear selfie with good lighting\n"
                        elif capture_type == 'DOCUMENT_CAPTURE':
                            doc_type = step.get('strict_validation_type', 'document')
                            workflow_context += f"        - Instructions: Help user capture their {doc_type} clearly\n"
                    elif step_type == 'QUESTIONNAIRE':
                        questions = step.get('questionnaire', {}).get('questions', [])
                        workflow_context += f"        - Questions: {len(questions)} questions to ask\n"
                        for j, question in enumerate(questions, 1):
                            question_text = question.get('title', f'Question {j}')
                            workflow_context += f"          {j}. {question_text}\n"
                    
                    if step_description:
                        workflow_context += f"        - Description: {step_description}\n"
                    
                    workflow_context += "\n"
                
                workflow_context += "        STEP-BY-STEP GUIDANCE:\n"
                workflow_context += "        - Guide users through each step in the order listed above\n"
                workflow_context += "        - Provide clear, simple instructions for each step type\n"
                workflow_context += "        - Give positive feedback when steps are completed successfully\n"
                workflow_context += "        - Move to the next step only after the current step is completed\n"
                
                return base_instructions + workflow_context
            else:
                # Fallback if no workflow steps
                fallback_context = "\n\n        WORKFLOW CONTEXT:\n"
                fallback_context += "        No specific workflow steps provided. Use your general KYC knowledge to guide the user through:\n"
                fallback_context += "        - Basic questionnaire about personal information\n"
                fallback_context += "        - Face capture for identity verification\n"
                fallback_context += "        - Document capture (PAN card etc.)\n"
                
                return base_instructions + fallback_context
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error creating instructions with workflow context: {e}")
            # Return base instructions if there's an error
            return base_instructions
    
    async def on_enter(self) -> None:
        """Called when the agent enters the meeting"""
        logger.info("🎯 KYC Voice Agent entered the meeting")
        
        try:
            # Wait a moment for the session to be fully initialized
            await asyncio.sleep(1)
            
            # Check if session is available
            if not hasattr(self, 'session') or not self.session:
                logger.warning("🎯 AGENT: Session not available in on_enter")
                return
            
            # Send a simple, direct welcome message
            welcome_message = "Hello! I'm your KYC assistant. I'll help you complete your identity verification. Let's start with the first step."
            logger.info(f"🎯 AGENT: Sending welcome message: {welcome_message}")
            
            # Send the welcome message
            await self.session.say(welcome_message)
            logger.info("🎯 AGENT: Welcome message sent successfully")
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error in on_enter: {e}")
            # Send a simple fallback message
            try:
                if hasattr(self, 'session') and self.session:
                    fallback_message = "Hello! I'm your KYC assistant. Let's begin your verification."
                    await self.session.say(fallback_message)
                    logger.info("🎯 AGENT: Fallback welcome message sent")
            except Exception as fallback_error:
                logger.error(f"🎯 AGENT: Fallback message also failed: {fallback_error}")
    
    def _create_welcome_message(self, workflow_steps: list) -> str:
        """Create a warm, professional welcome message with proper instructions"""
        try:
            # Create a comprehensive welcome message with instructions
            welcome_msg = "Hello! I'm your KYC assistant. Welcome to your identity verification session. "
            welcome_msg += "I'll guide you through a few simple steps to complete your verification. "
            welcome_msg += "We'll start by taking a clear photo of your face, then capture your identity documents, "
            welcome_msg += "and finally ask you a few verification questions. "
            welcome_msg += "Please ensure you have good lighting and your documents ready. "
            welcome_msg += "Let's begin with the first step."
            
            return welcome_msg
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error creating welcome message: {e}")
            return "Hello! I'm your KYC assistant. I'll guide you through your identity verification process. Let's begin!"
    
    async def _start_first_step(self, first_step: dict) -> None:
        """Start the first step of the workflow"""
        try:
            step_type = first_step.get('type', '')
            step_title = first_step.get('title', '')
            step_description = first_step.get('description', '')
            
            if step_type == 'FRAME_CAPTURE':
                capture_type = first_step.get('frame_capture_type', '')
                if capture_type == 'FACE_CAPTURE':
                    message = "Perfect! Now let's take your selfie for identity verification. Please look directly at the camera and hold still. The system will automatically capture when you're positioned correctly."
                elif capture_type == 'DOCUMENT_CAPTURE':
                    doc_type = first_step.get('strict_validation_type', 'document')
                    message = f"Great! Now let's capture your {doc_type.upper()} document. Please hold the document steady in front of the camera, making sure all text is clearly visible. The system will automatically capture when the document is properly positioned."
                else:
                    message = "Let's capture your document. Please hold it steady in front of the camera."
            elif step_type == 'QUESTIONNAIRE':
                questions = first_step.get('questionnaire', {}).get('questions', [])
                message = f"Excellent! Now I'll ask you {len(questions)} questions to verify your information. Please answer each question clearly and accurately."
            else:
                message = f"Let's begin with {step_title}. {step_description}"
            
            await self.session.say(message)
            logger.info(f"🎯 AGENT: Started first step: {step_title} ({step_type})")
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error starting first step: {e}")
            await self.session.say("Let's begin with the first step.")

    async def on_exit(self) -> None:
        """Called when the agent exits the meeting"""
        logger.info("🎯 KYC Voice Agent exiting the meeting - starting cleanup process")
        
        try:
            # Send final message to user if session is still active
            if hasattr(self, 'session') and self.session and not self.session_ended:
                try:
                    await self.session.say("Thank you for completing your KYC verification. Your session is now ending. Have a great day!")
                    logger.info("✅ Final message sent to user")
                except Exception as say_error:
                    logger.warning(f"Could not send final message: {say_error}")
            
            # Log workflow completion summary
            if self.workflow_data:
                total_steps = len(self.get_all_in_call_steps())
                completed_steps = len(self.completed_steps)
                logger.info(f"🎯 Workflow summary - Total steps: {total_steps}, Completed: {completed_steps}")
            
            # Mark session as ended
            self.session_ended = True
            
            logger.info("🎯 KYC Voice Agent exited the meeting successfully")
            
        except Exception as e:
            logger.error(f"❌ Error during agent exit cleanup: {e}")
            # Still mark as ended to prevent hanging
            self.session_ended = True
    
    def _get_hardcoded_workflow(self):
        """Hardcoded workflow data - Agent only handles FRAME_CAPTURE and QUESTIONNAIRE steps"""
        return {
            "actionables": [
                {
                    "type": "ai_assisted_video",
                    "action_ref": "ai_assisted_video-1",
                    "title": "AI Video Verification",
                    "description": "Please do AI-assisted Video KYC",
                    "sub_actions": [
                        # In-call steps (handled by agent) - Questionnaire moved to first position
                        {
                            "type": "QUESTIONNAIRE",
                            "title": "QUESTIONNAIRE",
                            "description": "Questions",
                            "sub_action_step": "in_call",
                            "questionnaire": {
                                "questions": [
                                    {
                                        "title": "What is your name as per the document?",
                                        "input_type": "text",
                                        "mandatory": True
                                    },
                                    {
                                        "title": "What is your address as per the document?",
                                        "input_type": "text",
                                        "mandatory": True
                                    },
                                    {
                                        "title": "What is your monthly income?",
                                        "input_type": "text",
                                        "mandatory": True
                                    }
                                ]
                            }
                        },
                        {
                            "type": "FRAME_CAPTURE",
                            "title": "Customer Selfie",
                            "sub_action_ref": "frame_capture-1",
                            "description": "We are going to capture your selfie now",
                            "sub_action_step": "in_call",
                            "frame_capture_type": "FACE_CAPTURE",
                            "sub_action_name": "Customer Selfie"
                        }
                    ]
                }
            ]
        }

    def generate_workflow_aware_welcome(self, workflow_steps: list) -> str:
        """Generate a welcome message based on the actual workflow steps"""
        try:
            # Count different types of steps
            frame_capture_steps = [step for step in workflow_steps if step.get('type') == 'FRAME_CAPTURE']
            questionnaire_steps = [step for step in workflow_steps if step.get('type') == 'QUESTIONNAIRE']
            
            # Build a concise welcome message to avoid TTS truncation
            welcome_parts = [
                "Hello! I am your KYC Virtual Assistant."
            ]
            
            if frame_capture_steps:
                capture_types = []
                for step in frame_capture_steps:
                    capture_type = step.get('frame_capture_type', 'unknown')
                    if capture_type == 'FACE_CAPTURE':
                        capture_types.append("your selfie")
                    elif capture_type == 'DOCUMENT_CAPTURE':
                        capture_types.append("your documents")
                    else:
                        capture_types.append("images")
                
                if capture_types:
                    welcome_parts.append(f"I'll help you capture {', '.join(capture_types)}.")
            
            if questionnaire_steps:
                welcome_parts.append("I'll also ask you some questions.")
            
            welcome_parts.append("Let's begin!")
            
            return " ".join(welcome_parts)
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error generating workflow-aware welcome: {e}")
            # Return a shorter fallback welcome if there's an error
            return "Hello! I am your KYC Virtual Assistant. I'll help you complete your identity verification. Let's begin!"

    def get_all_in_call_steps(self):
        """Get all workflow steps that the agent should handle"""
        # Always use hardcoded workflow for consistent behavior
        workflow_data = self._get_hardcoded_workflow()
        
        if not workflow_data or not workflow_data.get('actionables'):
            logger.warning("🎯 No workflow data or actionables found")
            return []
        
        all_steps = []
        pre_steps = []
        other_steps = []
        
        for actionable in workflow_data['actionables']:
            if actionable.get('sub_actions'):
                for sub_action in actionable['sub_actions']:
                    step_type = sub_action.get('sub_action_step', 'unknown')
                    step_title = sub_action.get('title', sub_action.get('sub_action_ref', 'Unknown'))
                    
                    if step_type == 'in_call':
                        all_steps.append(sub_action)
                        logger.debug(f"🎯 AGENT: Including in-call step: {step_title}")
                    elif step_type == 'pre':
                        pre_steps.append(sub_action)
                        logger.debug(f"🎯 AGENT: Excluding pre-call step: {step_title}")
                    else:
                        other_steps.append(sub_action)
                        logger.debug(f"🎯 AGENT: Excluding {step_type} step: {step_title}")
        
        logger.info(f"🎯 AGENT: Step filtering results - In-call: {len(all_steps)}, Pre-call: {len(pre_steps)}, Other: {len(other_steps)}")
        logger.info(f"🎯 AGENT: Agent will handle {len(all_steps)} in-call steps only")
        
        # Log the steps that will be handled by the agent
        if all_steps:
            logger.info("🎯 AGENT: In-call steps that agent will handle:")
            for i, step in enumerate(all_steps, 1):
                step_title = step.get('title', step.get('sub_action_ref', 'Unknown'))
                step_type = step.get('type', 'Unknown')
                logger.info(f"🎯 AGENT:   {i}. {step_title} ({step_type})")
        
        return all_steps
    
    def get_current_step(self):
        """Get the current step from workflow"""
        in_call_steps = self.get_all_in_call_steps()
        if self.current_step_index < len(in_call_steps):
            return in_call_steps[self.current_step_index]
        return None
    
    def get_next_step(self):
        """Get the next step from workflow"""
        in_call_steps = self.get_all_in_call_steps()
        next_index = self.current_step_index + 1
        if next_index < len(in_call_steps):
            return in_call_steps[next_index]
        return None
    
    def get_workflow_summary(self):
        """Get a summary of the current workflow for context"""
        in_call_steps = self.get_all_in_call_steps()
        return {
            'total_steps': len(in_call_steps),
            'current_step_index': self.current_step_index,
            'completed_steps': len(self.completed_steps),
            'remaining_steps': len(in_call_steps) - self.current_step_index,
            'workflow_data': self.workflow_data
        }

    def reset_step_tracking(self):
        """Reset the agent's step tracking - useful for debugging"""
        logger.info("🎯 AGENT: Resetting step tracking")
        self.current_step_index = 0
        self.completed_steps = []
        logger.info(f"🎯 AGENT: Step tracking reset - index: {self.current_step_index}, completed: {self.completed_steps}")
    
    def get_step_status(self):
        """Get current step status for debugging"""
        current_step = self.get_current_step()
        return {
            "current_step_index": self.current_step_index,
            "completed_steps": self.completed_steps,
            "current_step": current_step.get('sub_action_ref') if current_step else None,
            "total_steps": len(self.get_all_in_call_steps())
        }

    async def handle_step_completion(self, step_id: str, step_data: dict = None):
        """Handle step completion notification from backend - only for in-call steps"""
        logger.info(f"🎯 AGENT: Received step completion notification for step: {step_id}")
        logger.info(f"🎯 AGENT: Current step index: {self.current_step_index}, Completed steps: {self.completed_steps}")
        
        try:
            # Check if session is available
            if not hasattr(self, 'session') or not self.session:
                logger.warning("🎯 AGENT: Session not available for step completion")
                return
            
            # Get current step to verify it matches (only in-call steps are considered)
            current_step = self.get_current_step()
            logger.info(f"🎯 AGENT: Current step: {current_step.get('sub_action_ref') if current_step else 'None'}")
            
            if current_step and current_step.get('sub_action_ref') == step_id:
                # Double-check that this is an in-call step
                if current_step.get('sub_action_step') != 'in_call':
                    logger.warning(f"🎯 AGENT: Ignoring step completion for non-in-call step: {step_id} (type: {current_step.get('sub_action_step')})")
                    return
                
                # Check if this step was already completed
                if step_id in self.completed_steps:
                    logger.warning(f"🎯 AGENT: Step {step_id} was already completed, ignoring duplicate completion")
                    return
                
                # Validate step completion based on step type
                if not self._validate_step_completion(current_step, step_data):
                    logger.warning(f"🎯 AGENT: Step {step_id} completion validation failed")
                    await self.session.say("I notice the step wasn't completed properly. Let me help you with that again.")
                    return
                
                logger.info(f"🎯 AGENT: Step {step_id} completed successfully and validated")
                
                # Mark step as completed
                self.completed_steps.append(step_id)
                self.current_step_index += 1
                
                logger.info(f"🎯 AGENT: Updated step index to: {self.current_step_index}")
                
                # Get next step
                next_step = self.get_current_step()
                logger.info(f"🎯 AGENT: Next step: {next_step.get('sub_action_ref') if next_step else 'None'}")
                
                if next_step:
                    # Generate completion message and next step instruction
                    completion_message = self._generate_step_completion_message(current_step, next_step)
                    
                    # Send completion acknowledgment
                    await self.session.say(completion_message)
                    
                    # Handle different step types
                    if next_step.get('type') == 'QUESTIONNAIRE':
                        # Start questionnaire step
                        await asyncio.sleep(2)
                        questionnaire_data = next_step.get('questionnaire', {})
                        await self._handle_questionnaire_step(step_id, questionnaire_data)
                    else:
                        # Generate next step instruction for other step types
                        next_instruction = self._generate_step_instruction(next_step)
                        await asyncio.sleep(2)
                        await self.session.say(next_instruction)
                    
                    logger.info(f"🎯 AGENT: Moved to next step: {next_step.get('title', 'Unknown')}")
                else:
                    # No more steps - workflow complete
                    completion_message = self._generate_step_completion_message(current_step, None)
                    await self.session.say(completion_message)
                    logger.info("🎯 AGENT: All steps completed - workflow finished")
            else:
                logger.warning(f"🎯 AGENT: Received completion for unexpected step: {step_id}. Expected: {current_step.get('sub_action_ref') if current_step else 'None'}")
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error handling step completion: {e}")
            try:
                if hasattr(self, 'session') and self.session:
                    await self.session.say("I received your response. Let me process that and continue with the next step.")
            except Exception as say_error:
                logger.error(f"🎯 AGENT: Could not send error message: {say_error}")
    
    def _generate_step_completion_message(self, completed_step: dict, next_step: dict = None) -> str:
        """Generate a completion message for a step"""
        try:
            completed_title = completed_step.get('title', 'step')
            completed_type = completed_step.get('type', '')
            
            if completed_type == 'FRAME_CAPTURE':
                if completed_step.get('frame_capture_type') == 'FACE_CAPTURE':
                    completion_msg = "Excellent! Your selfie has been captured successfully. The image quality is perfect for identity verification. I can clearly see your face and the lighting is good."
                elif completed_step.get('frame_capture_type') == 'DOCUMENT_CAPTURE':
                    doc_type = completed_step.get('strict_validation_type', 'document')
                    completion_msg = f"Perfect! Your {doc_type.upper()} document has been captured successfully. All the text is clearly visible and readable. The document quality is excellent for verification."
                else:
                    completion_msg = f"Great! Your {completed_title} has been captured successfully. The capture quality looks excellent."
            elif completed_type == 'QUESTIONNAIRE':
                completion_msg = "Thank you for providing those details. Your responses have been recorded successfully and will be used for verification purposes."
            else:
                completion_msg = f"Excellent! {completed_title} completed successfully. The quality looks great."
            
            if next_step:
                next_title = next_step.get('title', 'next step')
                return f"{completion_msg} Now let's move to the next step."
            else:
                return f"{completion_msg} We've finished all the required steps for your KYC verification. Thank you!"
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error generating completion message: {e}")
            return "Step completed successfully. Let's continue."
    
    def _generate_step_instruction(self, step: dict) -> str:
        """Generate instruction for a step"""
        try:
            step_type = step.get('type', '')
            step_title = step.get('title', '')
            
            if step_type == 'FRAME_CAPTURE':
                if step.get('frame_capture_type') == 'FACE_CAPTURE':
                    return f"Now let's take your selfie. Please look directly at the camera and keep your face centered with good lighting."
                else:
                    doc_type = step.get('strict_validation_type', 'document')
                    return f"Now let's capture your {doc_type}. Please hold the document steady in front of the camera, ensuring all text is clearly visible."
            elif step_type == 'QUESTIONNAIRE':
                return f"Now I have some questions for you. Please answer each question clearly."
            else:
                return f"Let's continue with {step_title.lower()}."
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error generating step instruction: {e}")
            return "Let's continue with the next step."
    
    async def _handle_questionnaire_step(self, step_id: str, questionnaire_data: dict):
        """Handle questionnaire step - ask questions one by one"""
        logger.info(f"🎯 AGENT: Starting questionnaire step: {step_id}")
        
        try:
            questions = questionnaire_data.get('questions', [])
            if not questions:
                await self.session.say("I don't have any questions for you at this time.")
                return
            
            # Ask first question
            await self._ask_next_question(step_id, questions, 0)
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error handling questionnaire step: {e}")
            await self.session.say("I'm having trouble with the questionnaire. Let's continue with the next step.")
    
    async def _ask_next_question(self, step_id: str, questions: list, question_index: int):
        """Ask the next question in the questionnaire"""
        if question_index >= len(questions):
            # All questions answered, complete the questionnaire
            await self._complete_questionnaire(step_id)
            return
        
        question = questions[question_index]
        question_text = question.get('title', f'Question {question_index + 1}')
        
        # Ask the question via voice
        await self.session.say(f"Question {question_index + 1}: {question_text}")
        logger.info(f"🎯 AGENT: Asked question {question_index + 1}: {question_text}")
        
        # Send question to frontend for display
        await self._send_question_to_frontend(question, question_index, questions)
        
        # Store current question context for when user responds
        self.current_question_context = {
            'step_id': step_id,
            'questions': questions,
            'current_index': question_index,
            'question': question
        }
    
    async def _send_question_to_frontend(self, question: dict, question_index: int, all_questions: list):
        """Send question to frontend for display"""
        try:
            # Create a structured message that the frontend can parse
            question_data = {
                'type': 'questionnaire_question',
                'question': question,
                'questionIndex': question_index,
                'totalQuestions': len(all_questions),
                'questionId': f'question_{question_index}',
                'timestamp': int(time.time() * 1000)
            }
            
            # Send via session message (this will be received by the frontend)
            if hasattr(self, 'session') and self.session:
                # Use a special message format that the frontend can detect
                message = f"[QUESTIONNAIRE_QUESTION]{json.dumps(question_data)}[/QUESTIONNAIRE_QUESTION]"
                await self.session.say(message)
                logger.info(f"🎯 AGENT: Sent question to frontend: {question.get('title', 'Unknown')}")
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error sending question to frontend: {e}")
    
    async def _complete_questionnaire(self, step_id: str):
        """Complete the questionnaire and submit answers"""
        logger.info(f"🎯 AGENT: Completing questionnaire for step: {step_id}")
        
        try:
            if not hasattr(self, 'questionnaire_answers') or not self.questionnaire_answers:
                await self.session.say("I don't have any answers to submit. Let's continue with the next step.")
                return
            
            # Submit answers to backend
            await self._submit_questionnaire_answers(step_id, self.questionnaire_answers)
            
            # Clear the answers and context
            self.questionnaire_answers = {}
            self.current_question_context = None
            
            await self.session.say("Thank you for answering all the questions. Your responses have been recorded successfully.")
            
            # Mark step as completed
            result = await self._complete_workflow_step(step_id, {"questionnaire_completed": True})
            if result.get("status") == "error":
                logger.error(f"🎯 AGENT: Failed to complete workflow step: {result.get('error')}")
                await self.session.say("I had trouble completing this step. Let's continue with the next step.")
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error completing questionnaire: {e}")
            await self.session.say("I had trouble submitting your answers. Let's continue with the next step.")
    
    async def _submit_questionnaire_answers(self, step_id: str, answers: dict):
        """Submit questionnaire answers to backend"""
        try:
            # This would typically make an API call to submit the answers
            # For now, we'll just log them
            logger.info(f"🎯 AGENT: Submitting questionnaire answers for step: {step_id}")
            logger.info(f"🎯 AGENT: Answers: {answers}")
            
            # TODO: Make actual API call to submit answers
            # await self.api_client.submit_questionnaire_answers(step_id, answers)
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error submitting questionnaire answers: {e}")
            raise
    
    def _validate_step_completion(self, step: dict, step_data: dict = None) -> bool:
        """Validate that a step is actually completed based on its type and data"""
        try:
            step_type = step.get('type', '')
            step_id = step.get('sub_action_ref', '')
            
            logger.info(f"🎯 AGENT: Validating step completion for {step_id} (type: {step_type})")
            
            if step_type == 'FRAME_CAPTURE':
                # For frame capture, check if image data is present
                if step_data and step_data.get('image_data'):
                    logger.info(f"🎯 AGENT: Frame capture validation passed - image data present")
                    return True
                else:
                    logger.warning(f"🎯 AGENT: Frame capture validation failed - no image data")
                    return False
                    
            elif step_type == 'QUESTIONNAIRE':
                # For questionnaire, check if answers are present
                if step_data and step_data.get('answers'):
                    answers = step_data.get('answers', {})
                    if len(answers) > 0:
                        logger.info(f"🎯 AGENT: Questionnaire validation passed - {len(answers)} answers provided")
                        return True
                    else:
                        logger.warning(f"🎯 AGENT: Questionnaire validation failed - no answers provided")
                        return False
                else:
                    logger.warning(f"🎯 AGENT: Questionnaire validation failed - no answers data")
                    return False
                    
            else:
                # For other step types, assume completion is valid if step_data is provided
                if step_data:
                    logger.info(f"🎯 AGENT: Step validation passed - step data present for {step_type}")
                    return True
                else:
                    logger.warning(f"🎯 AGENT: Step validation failed - no step data for {step_type}")
                    return False
                    
        except Exception as e:
            logger.error(f"🎯 AGENT: Error validating step completion: {e}")
            return False

    async def _check_current_step_data(self) -> bool:
        """Check if the current step's required data is actually present"""
        try:
            current_step = self.get_current_step()
            if not current_step:
                logger.warning("🎯 AGENT: No current step to validate")
                return False
            
            step_type = current_step.get('type', '')
            step_id = current_step.get('sub_action_ref', '')
            
            logger.info(f"🎯 AGENT: Checking data for current step: {step_id} (type: {step_type})")
            
            if step_type == 'FRAME_CAPTURE':
                # For frame capture, we need to check if an image was actually captured
                logger.info(f"🎯 AGENT: Frame capture step - checking if image was captured")
                return await self._verify_image_capture(step_id)
                
            elif step_type == 'QUESTIONNAIRE':
                # For questionnaire, check if answers were actually submitted
                logger.info(f"🎯 AGENT: Questionnaire step - checking if answers were submitted")
                return await self._verify_questionnaire_completion(step_id)
                
            else:
                # For other step types, assume data is present
                logger.info(f"🎯 AGENT: Other step type - assuming data is present")
                return True
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error checking current step data: {e}")
            return False

    async def _handle_user_completion_attempt(self, user_message: str) -> bool:
        """Handle when user says they are done with a step - validate actual completion"""
        try:
            # Check if user is indicating completion
            completion_indicators = [
                "done", "finished", "completed", "ready", "next", "move on", 
                "that's it", "all set", "good to go", "proceed", "continue"
            ]
            
            user_lower = user_message.lower()
            is_completion_attempt = any(indicator in user_lower for indicator in completion_indicators)
            
            if not is_completion_attempt:
                return False  # Not a completion attempt
            
            logger.info(f"🎯 AGENT: User indicated completion: '{user_message}'")
            
            # Check if current step data is actually present
            has_required_data = await self._check_current_step_data()
            
            if has_required_data:
                logger.info(f"🎯 AGENT: User completion validated - required data is present")
                return True
            else:
                logger.warning(f"🎯 AGENT: User completion not validated - required data missing")
                
                # Get current step to provide specific guidance
                current_step = self.get_current_step()
                if current_step:
                    step_type = current_step.get('type', '')
                    step_title = current_step.get('title', 'this step')
                    
                    if step_type == 'FRAME_CAPTURE':
                        capture_type = current_step.get('frame_capture_type', '')
                        if capture_type == 'FACE_CAPTURE':
                            await self.session.say("I understand you'd like to move on, but I need to make sure we have a clear photo of your face first. Please use the camera button to take your selfie, or let me know if you need help with that.")
                        elif capture_type == 'DOCUMENT_CAPTURE':
                            doc_type = current_step.get('strict_validation_type', 'document')
                            await self.session.say(f"I understand you'd like to move on, but I need to make sure we have a clear photo of your {doc_type} first. Please use the camera button to capture your document, or let me know if you need help with that.")
                        else:
                            await self.session.say("I understand you'd like to move on, but I need to make sure we have captured the required image first. Please use the camera button to take the photo, or let me know if you need help with that.")
                    
                    elif step_type == 'QUESTIONNAIRE':
                        await self.session.say("I understand you'd like to move on, but I need to make sure you've answered all the verification questions first. Please complete the questionnaire, or let me know if you need help with any of the questions.")
                    
                    else:
                        await self.session.say(f"I understand you'd like to move on, but I need to make sure we've completed {step_title} properly first. Please complete the required action, or let me know if you need help.")
                
                return False
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error handling user completion attempt: {e}")
            return False

    async def on_user_speech(self, text: str) -> None:
        """Override to handle user speech and validate completion attempts"""
        try:
            logger.info(f"🎯 AGENT: User said: '{text}'")
            
            # Check if this is a completion attempt
            is_valid_completion = await self._handle_user_completion_attempt(text)
            
            if is_valid_completion:
                logger.info(f"🎯 AGENT: User completion validated, proceeding with step completion")
                # The step completion will be handled by the backend API call
                # We don't need to do anything here as the validation passed
            else:
                logger.info(f"🎯 AGENT: User completion not validated or not a completion attempt")
                # Let the normal conversation flow continue
                
        except Exception as e:
            logger.error(f"🎯 AGENT: Error in on_user_speech: {e}")
            # Continue with normal flow if there's an error

    async def _verify_image_capture(self, step_id: str) -> bool:
        """Verify if an image was actually captured for the given step"""
        try:
            # Get the room ID from the session
            if not hasattr(self, 'session') or not self.session:
                logger.warning("🎯 AGENT: No session available for image verification")
                return False
            
            # Get room ID from session context
            room_id = getattr(self.session, 'room_id', None)
            if not room_id:
                logger.warning("🎯 AGENT: No room ID available for image verification")
                return False
            
            # Make API call to check if image was uploaded for this step
            import aiohttp
            import os
            
            base_url = os.getenv('API_BASE_URL', 'http://localhost:8080')
            api_url = f"{base_url}/api/v1/sessions/{room_id}/verify-step-data"
            
            payload = {
                "step_id": step_id,
                "data_type": "image"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        has_data = result.get('has_data', False)
                        logger.info(f"🎯 AGENT: Image verification result for {step_id}: {has_data}")
                        return has_data
                    else:
                        logger.warning(f"🎯 AGENT: Image verification API failed with status {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"🎯 AGENT: Error verifying image capture: {e}")
            return False

    async def _verify_questionnaire_completion(self, step_id: str) -> bool:
        """Verify if questionnaire was actually completed for the given step"""
        try:
            # Get the room ID from the session
            if not hasattr(self, 'session') or not self.session:
                logger.warning("🎯 AGENT: No session available for questionnaire verification")
                return False
            
            # Get room ID from session context
            room_id = getattr(self.session, 'room_id', None)
            if not room_id:
                logger.warning("🎯 AGENT: No room ID available for questionnaire verification")
                return False
            
            # Make API call to check if questionnaire was completed for this step
            import aiohttp
            import os
            
            base_url = os.getenv('API_BASE_URL', 'http://localhost:8080')
            api_url = f"{base_url}/api/v1/sessions/{room_id}/verify-step-data"
            
            payload = {
                "step_id": step_id,
                "data_type": "questionnaire"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(api_url, json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        has_data = result.get('has_data', False)
                        logger.info(f"🎯 AGENT: Questionnaire verification result for {step_id}: {has_data}")
                        return has_data
                    else:
                        logger.warning(f"🎯 AGENT: Questionnaire verification API failed with status {response.status}")
                        return False
                        
        except Exception as e:
            logger.error(f"🎯 AGENT: Error verifying questionnaire completion: {e}")
            return False

    async def _complete_workflow_step(self, step_id: str, data: dict = None):
        """Complete a workflow step"""
        try:
            logger.info(f"🎯 AGENT: Completing workflow step: {step_id}")
            logger.info(f"🎯 AGENT: Step completion data: {data}")
            
            # This would typically make an API call to complete the step
            # For now, we'll just log it and return success
            logger.info(f"🎯 AGENT: Workflow step {step_id} completed successfully")
            return {"status": "success", "step_id": step_id, "message": "Step completed successfully"}
            
        except Exception as e:
            logger.error(f"🎯 AGENT: Error completing workflow step: {e}")
            return {"status": "error", "step_id": step_id, "error": str(e)}

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
            if not DISABLE_SIMLI and simli_avatar is None and self.settings.simli_api_key and self.settings.simli_avatar_id:
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
            elif DISABLE_SIMLI:
                logger.info("🎭 Simli Avatar disabled for RealTimePipeline - using voice-only mode")
            else:
                logger.info("🎭 No Simli Avatar available for RealTimePipeline - using voice-only mode")
            
            # Initialize Google Gemini Realtime model with Indian English
            model = GeminiRealtime(
                model="gemini-2.0-flash-live-001",
                api_key=self.settings.google_api_key,
                config=GeminiLiveConfig(
                    voice="Orus",  # Natural-sounding voice  #Orus for male Leda for female
                    response_modalities=["AUDIO"],  # Audio-only for faster processing
                    temperature=0.1,  # Low temperature for consistent responses
                    max_output_tokens=500,  # Increased from 200 to allow longer welcome messages
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
                
                # Store agent info (agent instance will be added later)
                self.active_agents[room_id] = {
                    "participant_id": agent_participant_id,
                    "workflow": workflow_json,
                    "status": "starting",
                    "agent": None  # Will be set when agent is created
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
            vision=True  # Enable vision for image analysis
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
        
        # For simple welcome messages, don't filter aggressively
        if any(phrase in message.lower() for phrase in ["hello", "welcome", "kyc assistant", "let's begin"]):
            # Only remove obvious technical patterns for welcome messages
            filtered_message = re.sub(r'\[function_call\]|\[tool_use\]|<function_call>.*?</function_call>', '', message)
            return filtered_message.strip()
        
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
            
            # Store the agent instance in active_agents for step completion notifications
            if room_id in self.active_agents:
                self.active_agents[room_id]["agent"] = agent
                logger.info(f"🎯 Stored agent instance for room: {room_id}")
            
            # Register workflow management tools
            # Function tools removed - step completion is now handled via backend API calls
            logger.info("✅ Agent configured without function tools - using backend API for step completion")
            
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
            
            # Initialize Simli Avatar with enhanced error handling
            simli_avatar = None
            simli_api_key = self.settings.simli_api_key
            simli_avatar_id = self.settings.simli_avatar_id
            logger.info(f"🎭 Using Simli avatar ID: {simli_api_key}, {simli_avatar_id}")
            
            # Initialize Simli Avatar if not disabled and credentials are available
            if not DISABLE_SIMLI and simli_api_key and simli_avatar_id:
                try:
                    simli_config = SimliConfig(
                        apiKey=simli_api_key,
                        faceId=simli_avatar_id,
                    )
                    simli_avatar = SimliAvatar(config=simli_config)
                    logger.info("🎭 Simli Avatar initialized successfully")
                except Exception as e:
                    logger.warning(f"⚠️ Failed to initialize Simli Avatar: {e}")
                    logger.info("🎭 Continuing without avatar")
                    simli_avatar = None
            elif DISABLE_SIMLI:
                logger.info("🎭 Simli Avatar disabled - continuing without avatar")
            else:
                logger.info("🎭 No Simli API credentials provided - continuing without avatar")

            # Create the cascading pipeline (following working repository pattern)
            pipeline_kwargs = {
                "stt": stt,
                "tts": tts,
                "llm": llm,
                "vad": vad,
                "turn_detector": turn_detector,
                "denoise": denoise
            }
            
            # Add avatar to pipeline if available and not disabled
            if not DISABLE_SIMLI and simli_avatar is not None:
                pipeline_kwargs["avatar"] = simli_avatar
                logger.info("🎭 Avatar included in pipeline")
            else:
                logger.info("🎭 No avatar - voice-only pipeline (Simli disabled or unavailable)")
            
            # Create pipeline based on configuration (no avatar if disabled)
            avatar_for_pipeline = simli_avatar if not DISABLE_SIMLI else None
            pipeline = self._create_pipeline(pipeline_kwargs, avatar_for_pipeline)
            
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
                elif "simli" in error_str or "nonetype" in error_str or "replace" in error_str:
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
                
                # Set the session reference on the agent for on_enter to use
                agent.session = session
                logger.info("🎯 Set session reference on agent")
                
                # Send initial greeting directly to ensure it works
                greeting = "Hello! I'm your KYC assistant. Welcome to your identity verification session. I'll guide you through a few simple steps to complete your verification. Let's begin with the first step."
                logger.info(f"🎯 Sending initial greeting: {greeting}")
                await session.say(greeting)
                logger.info("✅ Initial greeting sent successfully")
                
                # Call on_enter explicitly to ensure it runs
                logger.info("🎯 Calling agent.on_enter() explicitly...")
                await agent.on_enter()
                logger.info("✅ Agent on_enter() completed successfully")
                    
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