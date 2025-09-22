"""
Survey Agent implementation for the Enterprise AI Video KYC System.

This module implements a specialized agent for handling survey workflows,
including customer satisfaction surveys, market research, and feedback collection.
"""

from typing import Any, Dict, List, Optional
from datetime import datetime

from .base import BaseAgent, AgentConfig, AgentStatus
from ..exceptions import AgentError, WorkflowError


class SurveyAgent(BaseAgent):
    """
    Survey Agent for handling survey workflows.
    
    This agent specializes in conducting various types of surveys including:
    - Customer satisfaction surveys
    - Market research surveys
    - Feedback collection
    - Product evaluation surveys
    - User experience surveys
    """
    
    def __init__(self, config: AgentConfig, **kwargs):
        """Initialize the Survey agent."""
        super().__init__(config)
        self.survey_type: str = "general"
        self.questions: List[Dict[str, Any]] = []
        self.current_question_index = 0
        self.responses: List[Dict[str, Any]] = []
        self.survey_metadata: Dict[str, Any] = {}
        self.completion_rate: float = 0.0
        self.survey_status = "pending"
        
    async def initialize(self) -> None:
        """Initialize the Survey agent."""
        try:
            self.status = AgentStatus.INITIALIZING
            
            # Initialize survey-specific components
            await self._initialize_survey_system()
            await self._load_survey_questions()
            
            self.status = AgentStatus.IDLE
            
        except Exception as e:
            self.status = AgentStatus.ERROR
            await self.handle_error(e)
    
    async def start_session(self, session_id: str, room_id: str, **kwargs) -> None:
        """Start a survey session."""
        try:
            self.session_id = session_id
            self.room_id = room_id
            self.status = AgentStatus.ACTIVE
            
            # Reset session data
            self.current_question_index = 0
            self.responses = []
            self.completion_rate = 0.0
            self.survey_status = "in_progress"
            
            # Load survey configuration
            survey_config = kwargs.get("survey_config", {})
            self.survey_type = survey_config.get("type", "general")
            self.survey_metadata = survey_config.get("metadata", {})
            
            # Load questions for this survey type
            await self._load_survey_questions(self.survey_type)
            
            # Start with introduction
            await self._start_survey_introduction()
            
        except Exception as e:
            await self.handle_error(e)
    
    async def process_message(self, message: str, **kwargs) -> str:
        """Process a user message in the survey context."""
        try:
            self.last_activity = datetime.utcnow()
            
            # Get current question
            current_question = self._get_current_question()
            if not current_question:
                return await self._handle_survey_completion()
            
            # Process the response based on question type
            response_data = await self._process_question_response(current_question, message)
            
            # Store the response
            self.responses.append(response_data)
            
            # Update completion rate
            await self._update_completion_rate()
            
            # Move to next question
            await self._move_to_next_question()
            
            # Get next question or conclude
            next_question = self._get_current_question()
            if next_question:
                return await self._format_next_question(next_question)
            else:
                return await self._handle_survey_completion()
                
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
            elif step_type == "rating_collection":
                result.update(await self._process_rating_collection(step_data))
            elif step_type == "feedback_collection":
                result.update(await self._process_feedback_collection(step_data))
            elif step_type == "demographic_collection":
                result.update(await self._process_demographic_collection(step_data))
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
        """Pause the survey session."""
        self.status = AgentStatus.PAUSED
        await self.update_metrics({"session_paused_at": datetime.utcnow().isoformat()})
    
    async def resume_session(self) -> None:
        """Resume a paused survey session."""
        self.status = AgentStatus.ACTIVE
        await self.update_metrics({"session_resumed_at": datetime.utcnow().isoformat()})
    
    async def stop_session(self) -> None:
        """Stop the survey session."""
        self.status = AgentStatus.STOPPED
        self.survey_status = "completed"
        
        # Calculate final metrics
        await self._calculate_final_metrics()
        
        await self.update_metrics({
            "session_stopped_at": datetime.utcnow().isoformat(),
            "survey_status": self.survey_status,
            "questions_answered": len(self.responses),
            "completion_rate": self.completion_rate
        })
    
    async def cleanup(self) -> None:
        """Clean up Survey agent resources."""
        try:
            # Clear session data
            self.session_id = None
            self.room_id = None
            self.questions = []
            self.responses = []
            self.survey_metadata = {}
            
            # Reset status
            self.status = AgentStatus.IDLE
            
        except Exception as e:
            await self.handle_error(e)
    
    # Private methods for Survey-specific functionality
    
    async def _initialize_survey_system(self) -> None:
        """Initialize the survey system."""
        # This would integrate with survey management services
        await self.update_metrics({"survey_system_initialized": True})
    
    async def _load_survey_questions(self, survey_type: str = "general") -> None:
        """Load questions for the specified survey type."""
        # Default questions for different survey types
        question_banks = {
            "customer_satisfaction": [
                {
                    "id": "satisfaction_1",
                    "question": "How satisfied are you with our service?",
                    "type": "rating",
                    "options": ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
                    "required": True
                },
                {
                    "id": "recommendation_1",
                    "question": "How likely are you to recommend us to others?",
                    "type": "rating",
                    "options": ["Very Unlikely", "Unlikely", "Neutral", "Likely", "Very Likely"],
                    "required": True
                },
                {
                    "id": "feedback_1",
                    "question": "What could we improve?",
                    "type": "text",
                    "required": False
                }
            ],
            "market_research": [
                {
                    "id": "demographic_1",
                    "question": "What is your age range?",
                    "type": "multiple_choice",
                    "options": ["18-24", "25-34", "35-44", "45-54", "55+"],
                    "required": True
                },
                {
                    "id": "preference_1",
                    "question": "What features are most important to you?",
                    "type": "multiple_choice",
                    "options": ["Price", "Quality", "Customer Service", "Convenience", "Innovation"],
                    "required": True,
                    "allow_multiple": True
                },
                {
                    "id": "usage_1",
                    "question": "How often do you use our product?",
                    "type": "multiple_choice",
                    "options": ["Daily", "Weekly", "Monthly", "Rarely", "Never"],
                    "required": True
                }
            ],
            "general": [
                {
                    "id": "general_1",
                    "question": "How would you rate your overall experience?",
                    "type": "rating",
                    "options": ["Poor", "Fair", "Good", "Very Good", "Excellent"],
                    "required": True
                },
                {
                    "id": "general_2",
                    "question": "Any additional comments?",
                    "type": "text",
                    "required": False
                }
            ]
        }
        
        self.questions = question_banks.get(survey_type, question_banks["general"])
        await self.update_metrics({
            "questions_loaded": True,
            "question_count": len(self.questions),
            "survey_type": survey_type
        })
    
    async def _start_survey_introduction(self) -> None:
        """Start the survey introduction."""
        await self.update_metrics({"survey_started": True})
    
    def _get_current_question(self) -> Optional[Dict[str, Any]]:
        """Get the current survey question."""
        if 0 <= self.current_question_index < len(self.questions):
            return self.questions[self.current_question_index]
        return None
    
    async def _process_question_response(self, question: Dict[str, Any], response: str) -> Dict[str, Any]:
        """Process a response to a survey question."""
        response_data = {
            "question_id": question["id"],
            "question_text": question["question"],
            "question_type": question["type"],
            "response": response,
            "timestamp": datetime.utcnow().isoformat(),
            "is_valid": True
        }
        
        # Validate response based on question type
        validation_result = await self._validate_response(question, response)
        response_data["is_valid"] = validation_result["is_valid"]
        response_data["validation_errors"] = validation_result.get("errors", [])
        
        # Process response based on type
        if question["type"] == "rating":
            response_data["rating_value"] = await self._extract_rating_value(question, response)
        elif question["type"] == "multiple_choice":
            response_data["selected_options"] = await self._extract_selected_options(question, response)
        elif question["type"] == "text":
            response_data["text_analysis"] = await self._analyze_text_response(response)
        
        return response_data
    
    async def _validate_response(self, question: Dict[str, Any], response: str) -> Dict[str, Any]:
        """Validate a response against question requirements."""
        errors = []
        
        # Check if required question is answered
        if question.get("required", False) and not response.strip():
            errors.append("This question is required")
        
        # Type-specific validation
        if question["type"] == "rating":
            if not await self._is_valid_rating_response(question, response):
                errors.append("Please select a valid rating option")
        elif question["type"] == "multiple_choice":
            if not await self._is_valid_multiple_choice_response(question, response):
                errors.append("Please select a valid option")
        
        return {
            "is_valid": len(errors) == 0,
            "errors": errors
        }
    
    async def _is_valid_rating_response(self, question: Dict[str, Any], response: str) -> bool:
        """Check if rating response is valid."""
        options = question.get("options", [])
        response_lower = response.lower()
        return any(option.lower() in response_lower for option in options)
    
    async def _is_valid_multiple_choice_response(self, question: Dict[str, Any], response: str) -> bool:
        """Check if multiple choice response is valid."""
        options = question.get("options", [])
        response_lower = response.lower()
        return any(option.lower() in response_lower for option in options)
    
    async def _extract_rating_value(self, question: Dict[str, Any], response: str) -> int:
        """Extract numeric rating value from response."""
        options = question.get("options", [])
        response_lower = response.lower()
        
        for i, option in enumerate(options):
            if option.lower() in response_lower:
                return i + 1
        
        return 0  # Default to 0 if no match found
    
    async def _extract_selected_options(self, question: Dict[str, Any], response: str) -> List[str]:
        """Extract selected options from multiple choice response."""
        options = question.get("options", [])
        response_lower = response.lower()
        selected = []
        
        for option in options:
            if option.lower() in response_lower:
                selected.append(option)
        
        return selected
    
    async def _analyze_text_response(self, response: str) -> Dict[str, Any]:
        """Analyze text response for sentiment and keywords."""
        # Simple analysis (in production, this would use NLP services)
        word_count = len(response.split())
        sentiment = "neutral"  # Would be determined by sentiment analysis
        
        return {
            "word_count": word_count,
            "sentiment": sentiment,
            "has_content": word_count > 0
        }
    
    async def _update_completion_rate(self) -> None:
        """Update the survey completion rate."""
        if self.questions:
            self.completion_rate = (len(self.responses) / len(self.questions)) * 100
            await self.update_metrics({"completion_rate": self.completion_rate})
    
    async def _move_to_next_question(self) -> None:
        """Move to the next survey question."""
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
        
        formatted_question = f"Question {question_num} of {total_questions}: {question['question']}"
        
        # Add options for multiple choice and rating questions
        if question["type"] in ["multiple_choice", "rating"]:
            options = question.get("options", [])
            if options:
                formatted_question += "\n\nOptions:"
                for i, option in enumerate(options, 1):
                    formatted_question += f"\n{i}. {option}"
        
        return formatted_question
    
    async def _handle_survey_completion(self) -> str:
        """Handle survey completion."""
        self.survey_status = "completed"
        await self._calculate_final_metrics()
        
        return f"Thank you for completing the survey! Your responses have been recorded. Completion rate: {self.completion_rate:.1f}%"
    
    async def _calculate_final_metrics(self) -> None:
        """Calculate final survey metrics."""
        if not self.responses:
            return
        
        # Calculate average ratings
        ratings = [r.get("rating_value", 0) for r in self.responses if r.get("rating_value")]
        if ratings:
            avg_rating = sum(ratings) / len(ratings)
            await self.update_metrics({"average_rating": avg_rating})
        
        # Calculate response quality
        valid_responses = sum(1 for r in self.responses if r.get("is_valid", False))
        response_quality = (valid_responses / len(self.responses)) * 100 if self.responses else 0
        await self.update_metrics({"response_quality": response_quality})
    
    async def _process_question_sequence(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a question sequence step."""
        return {
            "questions_processed": len(self.questions),
            "current_question": self.current_question_index + 1,
            "responses_collected": len(self.responses),
            "completion_rate": self.completion_rate
        }
    
    async def _process_rating_collection(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a rating collection step."""
        ratings = [r.get("rating_value", 0) for r in self.responses if r.get("rating_value")]
        return {
            "ratings_collected": len(ratings),
            "average_rating": sum(ratings) / len(ratings) if ratings else 0,
            "rating_distribution": self._calculate_rating_distribution(ratings)
        }
    
    async def _process_feedback_collection(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a feedback collection step."""
        text_responses = [r for r in self.responses if r.get("question_type") == "text"]
        return {
            "feedback_responses": len(text_responses),
            "total_word_count": sum(r.get("text_analysis", {}).get("word_count", 0) for r in text_responses)
        }
    
    async def _process_demographic_collection(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a demographic collection step."""
        demographic_responses = [r for r in self.responses if "demographic" in r.get("question_id", "")]
        return {
            "demographic_responses": len(demographic_responses),
            "demographics_collected": [r.get("question_id") for r in demographic_responses]
        }
    
    async def _process_generic_step(self, step_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process generic workflow step."""
        return {
            "processed": True,
            "step_data": step_data
        }
    
    def _calculate_rating_distribution(self, ratings: List[int]) -> Dict[str, int]:
        """Calculate distribution of ratings."""
        distribution = {}
        for rating in ratings:
            distribution[str(rating)] = distribution.get(str(rating), 0) + 1
        return distribution
