# Notification Sounds

This directory contains custom notification sounds for different warning types in the radar app.

## Sound Files

### Default Notification Sounds

- `default.mp3` - Default notification sound for general alerts
- `siren.mp3` - Police checkpoint alerts (siren sound)
- `crash.mp3` - Accident alerts (crash/impact sound)
- `warning.mp3` - Road hazard alerts (warning beep)
- `traffic.mp3` - Traffic jam alerts (horn sound)
- `weather.mp3` - Weather alerts (chime sound)

## Sound Requirements

### Technical Specifications
- **Format**: MP3 or WAV
- **Duration**: 1-3 seconds recommended
- **Sample Rate**: 44.1 kHz
- **Bit Rate**: 128-320 kbps
- **Channels**: Mono or Stereo
- **Volume**: Normalized to prevent clipping

### Design Guidelines
- **Distinctive**: Each category should have a unique, recognizable sound
- **Non-intrusive**: Sounds should be attention-getting but not jarring
- **Accessibility**: Consider users with hearing impairments
- **Cultural Sensitivity**: Avoid sounds that may be offensive in different cultures

## Sound Categories

### 🚔 Police Checkpoint (`siren.mp3`)
- **Purpose**: Alert users to police checkpoints ahead
- **Style**: Short siren burst or police radio beep
- **Duration**: 1-2 seconds
- **Volume**: Medium-high (important safety alert)

### 🚨 Accident (`crash.mp3`)
- **Purpose**: Alert users to accidents or crashes
- **Style**: Impact sound or urgent beep
- **Duration**: 1-2 seconds
- **Volume**: High (critical safety alert)

### ⚠️ Road Hazard (`warning.mp3`)
- **Purpose**: Alert users to road hazards (potholes, debris, etc.)
- **Style**: Warning beep or alert tone
- **Duration**: 1 second
- **Volume**: Medium-high

### 🚗 Traffic Jam (`traffic.mp3`)
- **Purpose**: Alert users to traffic congestion
- **Style**: Car horn or traffic sound
- **Duration**: 1-2 seconds
- **Volume**: Medium

### 🌧️ Weather Alert (`weather.mp3`)
- **Purpose**: Alert users to weather-related hazards
- **Style**: Gentle chime or rain sound
- **Duration**: 1-3 seconds
- **Volume**: Medium

### 📍 General (`default.mp3`)
- **Purpose**: Default sound for miscellaneous alerts
- **Style**: Standard notification beep
- **Duration**: 1 second
- **Volume**: Medium

## Custom Sounds

Users can add custom notification sounds through the app settings. Custom sounds should:

1. **Follow technical specifications** listed above
2. **Be appropriate** for the notification context
3. **Be tested** for clarity and volume
4. **Respect copyright** - only use royalty-free or owned sounds

## Implementation Notes

### Sound Service Integration
- Sounds are managed by `SoundService` class
- Preloaded for better performance
- Fallback to system sounds if custom sounds fail
- Volume control and muting support

### Platform Considerations
- **iOS**: Sounds play even in silent mode for safety alerts
- **Android**: Respects system notification settings
- **Expo**: Uses Expo AV for cross-platform audio support

### Performance
- Sounds are preloaded on app start
- Cached in memory for quick playback
- Automatic cleanup when app closes
- Optimized file sizes for mobile

## Adding New Sounds

To add new notification sounds:

1. **Prepare the audio file** following the technical specifications
2. **Add to appropriate category folder** or create new category
3. **Update SoundService** to include the new sound
4. **Test on both platforms** (iOS and Android)
5. **Update this documentation**

## Testing Sounds

Use the notification settings screen to:
- Preview sounds before setting them
- Test volume levels
- Verify sound plays correctly
- Check accessibility features

## Troubleshooting

### Common Issues
- **Sound not playing**: Check file format and permissions
- **Volume too low/high**: Adjust in notification settings
- **Distorted audio**: Check bit rate and sample rate
- **File not found**: Verify file path and name

### Debug Mode
Enable debug logging in SoundService to troubleshoot audio issues:
```typescript
console.log('🔊 Playing notification sound for category:', category);
```

## Legal Considerations

- **Copyright**: Ensure all sounds are royalty-free or properly licensed
- **Attribution**: Credit sound creators where required
- **Privacy**: Don't include sounds that could identify users
- **Accessibility**: Provide visual alternatives for hearing-impaired users

## Future Enhancements

Planned features:
- **Sound themes**: Preset collections of related sounds
- **Dynamic volume**: Adjust based on ambient noise
- **Spatial audio**: Directional alerts for navigation
- **Voice alerts**: Text-to-speech for detailed information
- **Haptic feedback**: Vibration patterns to complement sounds
