"""
Interview Agent implementation for the Enterprise AI Video KYC System.

This module implements a specialized agent for handling interview workflows,
including job interviews, assessment interviews, and evaluation sessions.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from .base import BaseAgent, AgentConfig, AgentStatus
from ..exceptions import AgentError, WorkflowError


class InterviewAgent(BaseAgent):
    """
    Interview Agent for handling interview workflows.
    
    This agent specializes in conducting various types of interviews including:
    - Job interviews
    - Assessment interviews
    - Evaluation sessions
    - Skills testing
    - Behavioral assessments
    """
    
    def __init__(self, config: AgentConfig, **kwargs):
        """Initialize the Interview agent."""
        super().__init__(config)
        self.interview_type: str = "general"
        self.questions: List[Dict[str, Any]] = []
        self.current_question_index = 0
        self.responses: List[Dict[str, Any]] = []
        self.evaluation_criteria: Dict[str, Any] = {}
        self.interview_score: float = 0.0
        self.interview_status = "pending"
        
    async def initialize(self) -> None:
        """Initialize the Interview agent."""
        try:
            self.status = AgentStatus.INITIALIZING
            
            # Initialize interview-specific components
            await self._initialize_evaluation_system()
            await self._load_interview_questions()
            
            self.status = AgentStatus.IDLE
            
        except Exception as e:
            self.status = AgentStatus.ERROR
            await self.handle_error(e)
    
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """Start an interview session."""
        try:
            self.session_id = session_id
            self.room_id = room_id
            self.status = AgentStatus.ACTIVE
            
            # Reset session data
            self.current_question_index = 0
            self.responses = []
            self.interview_score = 0.0
            self.interview_status = "in_progress"
            
            # Load interview configuration
            interview_config = kwargs.get("interview_config", {})
            self.interview_type = interview_config.get("type", "general")
            
            # Load questions for this interview type
            await self._load_interview_questions(self.interview_type)
            
            # Start with introduction
            await self._start_interview_introduction()
            
        except Exception as e:
            await self.handle_error(e)
    
    async def process_message(self, message: str, **kwargs) -> str:
        """Process a user message in the interview context."""
        try:
            self.last_activity = datetime.utcnow()
            
            # Get current question
            current_question = self._get_current_question()
            if not current_question:
                return await self._handle_interview_completion()
            
            # Process the response
            response_data = {
                "question_id": current_question["id"],
                "question_text": current_question["question"],
                "response": message,
                "timestamp": datetime.utcnow().isoformat(),
                "response_time_seconds": kwargs.get("response_time", 0)
            }
            
            # Evaluate the response
            evaluation = await self._evaluate_response(current_question, message)
            response_data["evaluation"] = evaluation
            
            # Store the response
            self.responses.append(response_data)
            
            # Move to next question
            await self._move_to_next_question()
            
            # Get next question or conclude
            next_question = self._get_current_question()
            if next_question:
                return await self._format_next_question(next_question)
            else:
                return await self._handle_interview_completion()
                
        except Exception as e:
            await self.handle_error(e)
            return "I encountered an error processing your response. Please try again."
    
    async def handle_workflow_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Handle a specific workflow step."""
        try:
            step_type = step_data.get("type")
            step_id = step_data.get("id")
            
            result = {
                "step_id": step_id,
                "step_type": step_type,
                "status": "processing",
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if step_type == "question_sequence":
                result.update(await self._process_question_sequence(step_data))
            elif step_type == "skill_assessment":
                result.update(await self._process_skill_assessment(step_data))
            elif step_type == "behavioral_assessment":
                result.update(await self._process_behavioral_assessment(step_data))
            elif step_type == "technical_evaluation":
                result.update(await self._process_technical_evaluation(step_data))
            else:
                result.update(await self._process_generic_step(step_data))
            
            result["status"] = "completed"
            return result
            
        except Exception as e:
            await self.handle_error(e)
            return {
                "step_id": step_data.get("id"),
                "status": "failed",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def pause_session(self) -> None:
        """Pause the interview session."""
        self.status = AgentStatus.PAUSED
        await self.update_metrics({"session_paused_at": datetime.utcnow().isoformat()})
    
    async def resume_session(self) -> None:
        """Resume a paused interview session."""
        self.status = AgentStatus.ACTIVE
        await self.update_metrics({"session_resumed_at": datetime.utcnow().isoformat()})
    
    async def stop_session(self) -> None:
        """Stop the interview session."""
        self.status = AgentStatus.STOPPED
        self.interview_status = "completed"
        
        # Calculate final score
        await self._calculate_final_score()
        
        await self.update_metrics({
            "session_stopped_at": datetime.utcnow().isoformat(),
            "interview_status": self.interview_status,
            "questions_answered": len(self.responses),
            "final_score": self.interview_score
        })
    
    async def cleanup(self) -> None:
        """Clean up Interview agent resources."""
        try:
            # Clear session data
            self.session_id = None
            self.room_id = None
            self.questions = []
            self.responses = []
            
            # Reset status
            self.status = AgentStatus.IDLE
            
        except Exception as e:
            await self.handle_error(e)
    
    # Private methods for Interview-specific functionality
    
    async def _initialize_evaluation_system(self) -> None:
        """Initialize the evaluation system."""
        # This would integrate with evaluation services
        await self.update_metrics({"evaluation_system_initialized": True})
    
    async def _load_interview_questions(self, interview_type: str = "general") -> None:
        """Load questions for the specified interview type."""
        # Default questions for different interview types
        question_banks = {
            "general": [
                {
                    "id": "intro_1",
                    "question": "Tell me about yourself and your background.",
                    "type": "behavioral",
                    "weight": 1.0,
                    "expected_keywords": ["experience", "skills", "background"]
                },
                {
                    "id": "motivation_1",
                    "question": "What motivates you in your work?",
                    "type": "behavioral",
                    "weight": 0.8,
                    "expected_keywords": ["passion", "growth", "challenge"]
                },
                {
                    "id": "strengths_1",
                    "question": "What are your greatest strengths?",
                    "type": "behavioral",
                    "weight": 0.9,
                    "expected_keywords": ["skills", "abilities", "strengths"]
                }
            ],
            "technical": [
                {
                    "id": "tech_1",
                    "question": "Describe a challenging technical problem you solved.",
                    "type": "technical",
                    "weight": 1.0,
                    "expected_keywords": ["problem", "solution", "technical"]
                },
                {
                    "id": "tech_2",
                    "question": "How do you stay updated with new technologies?",
                    "type": "technical",
                    "weight": 0.7,
                    "expected_keywords": ["learning", "technology", "development"]
                }
            ],
            "behavioral": [
                {
                    "id": "behavior_1",
                    "question": "Tell me about a time you had to work with a difficult team member.",
                    "type": "behavioral",
                    "weight": 1.0,
                    "expected_keywords": ["teamwork", "conflict", "resolution"]
                },
                {
                    "id": "behavior_2",
                    "question": "Describe a situation where you had to meet a tight deadline.",
                    "type": "behavioral",
                    "weight": 0.9,
                    "expected_keywords": ["deadline", "pressure", "delivery"]
                }
            ]
        }
        
        self.questions = question_banks.get(interview_type, question_banks["general"])
        await self.update_metrics({
            "questions_loaded": True,
            "question_count": len(self.questions),
            "interview_type": interview_type
        })
    
    async def _start_interview_introduction(self) -> None:
        """Start the interview introduction."""
        await self.update_metrics({"interview_started": True})
    
    def _get_current_question(self) -> Optional[Dict[str, Any]]:
        """Get the current interview question."""
        if 0 <= self.current_question_index < len(self.questions):
            return self.questions[self.current_question_index]
        return None
    
    async def _evaluate_response(self, question: Dict[str, Any], response: str) -> Dict[str, Any]:
        """Evaluate a candidate's response to a question."""
        # Simple keyword-based evaluation (in production, this would use AI/ML)
        expected_keywords = question.get("expected_keywords", [])
        response_lower = response.lower()
        
        keyword_matches = sum(1 for keyword in expected_keywords if keyword in response_lower)
        keyword_score = keyword_matches / len(expected_keywords) if expected_keywords else 0.5
        
        # Additional evaluation factors
        response_length = len(response.split())
        length_score = min(response_length / 50, 1.0)  # Optimal around 50 words
        
        # Calculate overall score
        overall_score = (keyword_score * 0.7) + (length_score * 0.3)
        
        return {
            "keyword_score": keyword_score,
            "length_score": length_score,
            "overall_score": overall_score,
            "keyword_matches": keyword_matches,
            "total_keywords": len(expected_keywords),
            "response_length": response_length
        }
    
    async def _move_to_next_question(self) -> None:
        """Move to the next interview question."""
        if self.current_question_index < len(self.questions) - 1:
            self.current_question_index += 1
            await self.update_metrics({
                "current_question": self.current_question_index + 1,
                "progress_percentage": ((self.current_question_index + 1) / len(self.questions)) * 100
            })
    
    async def _format_next_question(self, question: Dict[str, Any]) -> str:
        """Format the next question for presentation."""
        question_num = self.current_question_index + 1
        total_questions = len(self.questions)
        
        return f"Question {question_num} of {total_questions}: {question['question']}"
    
    async def _handle_interview_completion(self) -> str:
        """Handle interview completion."""
        await self._calculate_final_score()
        self.interview_status = "completed"
        
        return f"Thank you for completing the interview! Your overall score is {self.interview_score:.1f}/10. We will review your responses and get back to you soon."
    
    async def _calculate_final_score(self) -> None:
        """Calculate the final interview score."""
        if not self.responses:
            self.interview_score = 0.0
            return
        
        total_weighted_score = 0.0
        total_weight = 0.0
        
        for response in self.responses:
            question_id = response["question_id"]
            question = next((q for q in self.questions if q["id"] == question_id), None)
            
            if question:
                weight = question.get("weight", 1.0)
                score = response["evaluation"]["overall_score"]
                
                total_weighted_score += score * weight
                total_weight += weight
        
        self.interview_score = (total_weighted_score / total_weight) * 10 if total_weight > 0 else 0.0
    
    async def _process_question_sequence(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a question sequence step."""
        return {
            "questions_processed": len(self.questions),
            "current_question": self.current_question_index + 1,
            "responses_collected": len(self.responses)
        }
    
    async def _process_skill_assessment(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a skill assessment step."""
        return {
            "skill_assessment_completed": True,
            "skills_evaluated": step_data.get("skills", []),
            "assessment_score": self.interview_score
        }
    
    async def _process_behavioral_assessment(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a behavioral assessment step."""
        return {
            "behavioral_assessment_completed": True,
            "behaviors_evaluated": step_data.get("behaviors", []),
            "assessment_score": self.interview_score
        }
    
    async def _process_technical_evaluation(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a technical evaluation step."""
        return {
            "technical_evaluation_completed": True,
            "technologies_evaluated": step_data.get("technologies", []),
            "evaluation_score": self.interview_score
        }
    
    async def _process_generic_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process generic workflow step."""
        return {
            "processed": True,
            "step_data": step_data
        }
