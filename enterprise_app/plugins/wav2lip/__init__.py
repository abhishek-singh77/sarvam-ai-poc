"""
Wav2Lip Plugin for VideoSDK Agents

This plugin provides lip-sync capabilities for AI agents by connecting
to external Wav2Lip FastAPI server.
"""

from .wav2lip_avatar import Wav2LipAvatar, Wav2LipCustomVideoTrack

__all__ = ["Wav2LipAvatar", "Wav2LipCustomVideoTrack"]
