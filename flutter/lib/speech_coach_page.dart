import 'dart:io';
import 'dart:async';
import 'dart:convert';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:http/http.dart' as http;

/// ââââââââââââââââââââââââââââââââââââââââââââââ
/// Mangoi Speech Coach - ìì´ ë°ì êµì  íì´ì§
/// ê¸°ë¥: ë¬¸ì¥ íì â ìì´ë¯¼ ë°ì ë£ê¸° â ë¹ì â AI ë¶ì â ë´ ë¹ì ì¬ì
/// ââââââââââââââââââââââââââââââââââââââââââââââ

class SpeechCoachPage extends StatefulWidget {
  const SpeechCoachPage({super.key});

  @override
  State<SpeechCoachPage> createState() => _SpeechCoachPageState();
}

class _SpeechCoachPageState extends State<SpeechCoachPage>
    with SingleTickerProviderStateMixin {
  // ââ ë¹ì / ì¬ì ââ
  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _player = AudioPlayer();
  final AudioPlayer _ttsPlayer = AudioPlayer(); // ìì´ë¯¼ ë°ìì©

  // ââ ìí ââ
  bool _isRecording = false;
  bool _isPlaying = false;
  bool _hasRecording = false;
  bool _isAnalyzing = false;
  String? _recordingPath;

  // ââ ì¬ì ì§íë¥  ââ
  Duration _playbackPosition = Duration.zero;
  Duration _playbackDuration = Duration.zero;

  // ââ ë¬¸ì¥ ë°ì´í° ââ
  String _currentSentence = '';
  String _currentTranslation = '';
  int _currentLevel = 0; // Level0~Level8
  int _attemptNumber = 1;
  static const int maxAttempts = 3;

  // ââ AI í¼ëë°± ê²°ê³¼ ââ
  Map<String, dynamic>? _feedbackResult;
  bool _showFeedback = false;

  // ââ ë ë²¨ ì ë³´ ââ
  final List<Map<String, String>> _levels = [
    {'name': 'Phonics', 'label': 'Level 0'},
    {'name': 'BTS 1~4', 'label': 'Level 1'},
    {'name': 'BTS 5~8', 'label': 'Level 2'},
    {'name': 'BTS 9~12', 'label': 'Level 3'},
    {'name': 'BTS 13~16', 'label': 'Level 4'},
    {'name': 'BTS 17~20', 'label': 'Level 5'},
    {'name': 'BTS 21~24', 'label': 'Level 6'},
    {'name': 'BTS 25~28', 'label': 'Level 7'},
    {'name': 'BTS 29~34', 'label': 'Level 8'},
  ];

  // ââ ìë ì¡°ì  ââ
  double _playbackSpeed = 0.9;

  // ââ ì ëë©ì´ì ââ
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _loadSentence();
    _setupPlayerListeners();

    // ë¹ì ë²í¼ ë§¥ë° ì ëë©ì´ì
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
    _pulseAnimation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  void _setupPlayerListeners() {
    _player.onPositionChanged.listen((pos) {
      if (mounted) setState(() => _playbackPosition = pos);
    });
    _player.onDurationChanged.listen((dur) {
      if (mounted) setState(() => _playbackDuration = dur);
    });
    _player.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() {
          _isPlaying = false;
          _playbackPosition = Duration.zero;
        });
      }
    });
  }

  @override
  void dispose() {
    _recorder.dispose();
    _player.dispose();
    _ttsPlayer.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ë¬¸ì¥ ë¡ë
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Future<void> _loadSentence() async {
    // TODO: Firebase ëë APIìì ë ë²¨ë³ ë¬¸ì¥ ê°ì ¸ì¤ê¸°
    // ìì ìë¬¸
    setState(() {
      _currentSentence =
          'The instructor gave us detailed explanations of each dance movement.';
      _currentTranslation = 'ê°ì¬ê° ê° ëì¤ ëìì ëí´ ìì¸í ì¤ëªì í´ì£¼ììµëë¤.';
      _attemptNumber = 1;
      _feedbackResult = null;
      _showFeedback = false;
      _hasRecording = false;
    });
  }

  Future<void> _changeSentence() async {
    // TODO: ë¤ì ë¬¸ì¥ ë¡ë
    await _loadSentence();
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ìì´ë¯¼ ë°ì ë£ê¸° (TTS)
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Future<void> _playNativePronunciation() async {
    // TODO: Firebase TTS ëë Google TTS API í¸ì¶
    // ìì: Google TTS URL
    final url =
        'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${Uri.encodeComponent(_currentSentence)}';
    await _ttsPlayer.setPlaybackRate(_playbackSpeed);
    await _ttsPlayer.play(UrlSource(url));
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ë¹ì ìì / ì¤ì§
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Future<void> _toggleRecording() async {
    if (_isRecording) {
      await _stopRecording();
    } else {
      await _startRecording();
    }
  }

  Future<void> _startRecording() async {
    // ê¶í íì¸
    if (!await _recorder.hasPermission()) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('ë§ì´í¬ ê¶íì´ íìí©ëë¤'),
            backgroundColor: Colors.red,
          ),
        );
      }
      return;
    }

    // ë¹ì íì¼ ê²½ë¡
    final dir = await getApplicationDocumentsDirectory();
    final path =
        '${dir.path}/speech_recording_${DateTime.now().millisecondsSinceEpoch}.m4a';

    // ë¹ì ìì
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
      ),
      path: path,
    );

    setState(() {
      _isRecording = true;
      _recordingPath = path;
      _hasRecording = false;
      _showFeedback = false;
    });

    _pulseController.repeat(reverse: true);
  }

  Future<void> _stopRecording() async {
    final path = await _recorder.stop();
    _pulseController.stop();
    _pulseController.reset();

    if (path != null && File(path).existsSync()) {
      setState(() {
        _isRecording = false;
        _recordingPath = path;
        _hasRecording = true;
      });

      // ë¹ì ìë£ í AI ë¶ì ìì
      await _analyzeRecording();
    } else {
      setState(() => _isRecording = false);
    }
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ë´ ë¹ì ì¬ì
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Future<void> _togglePlayback() async {
    if (_isPlaying) {
      await _player.pause();
      setState(() => _isPlaying = false);
    } else if (_recordingPath != null) {
      await _player.play(DeviceFileSource(_recordingPath!));
      setState(() => _isPlaying = true);
    }
  }

  Future<void> _seekTo(double value) async {
    final position = Duration(
      milliseconds: (value * _playbackDuration.inMilliseconds).round(),
    );
    await _player.seek(position);
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  AI ë°ì ë¶ì
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Future<void> _analyzeRecording() async {
    if (_recordingPath == null) return;

    setState(() => _isAnalyzing = true);

    try {
      // TODO: ì¤ì  AI API ìëí¬ì¸í¸ë¡ êµì²´
      // ìë²ì ë¹ì íì¼ ì ì¡ â ë¶ì ê²°ê³¼ ìì 
      /*
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('https://your-api.com/analyze'),
      );
      request.files.add(
        await http.MultipartFile.fromPath('audio', _recordingPath!),
      );
      request.fields['sentence'] = _currentSentence;
      request.fields['level'] = _currentLevel.toString();

      final response = await request.send();
      final body = await response.stream.bytesToString();
      final result = jsonDecode(body);
      */

      // ìì ë¶ì ê²°ê³¼ (ë°ëª¨ì©)
      await Future.delayed(const Duration(seconds: 2));
      final result = {
        'spokenText': 'The instructor gave us detailed explanations',
        'correctedText': _currentSentence,
        'scores': {
          'accuracy': 85,
          'fluency': 80,
          'completeness': 70,
        },
        'errors': [
          {
            'word': 'explanations',
            'type': 'pronunciation',
            'suggestion': 'ex-pluh-NAY-shunz',
          },
          {
            'word': 'movement',
            'type': 'missing',
            'suggestion': 'ë¬¸ì¥ ëê¹ì§ ë§í´ë³´ì¸ì',
          },
        ],
        'overallScore': 78,
      };

      setState(() {
        _feedbackResult = result;
        _showFeedback = true;
        _isAnalyzing = false;
      });
    } catch (e) {
      setState(() => _isAnalyzing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('ë¶ì ì¤ ì¤ë¥ê° ë°ìíìµëë¤: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ë¤ì ìë
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  void _nextAttempt() {
    if (_attemptNumber < maxAttempts) {
      setState(() {
        _attemptNumber++;
        _showFeedback = false;
        _hasRecording = false;
        _feedbackResult = null;
        _recordingPath = null;
      });
    } else {
      _changeSentence();
    }
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  UI ë¹ë
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1a1a3e),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            children: [
              _buildHeader(),
              const SizedBox(height: 16),
              _buildLevelSelector(),
              const SizedBox(height: 20),
              _buildSentenceCard(),
              const SizedBox(height: 24),
              _buildAttemptIndicator(),
              const SizedBox(height: 20),
              _buildRecordButton(),
              const SizedBox(height: 24),
              if (_isAnalyzing) _buildAnalyzingIndicator(),
              if (_showFeedback && _feedbackResult != null) ...[
                _buildFeedbackSection(),
                const SizedBox(height: 16),
                _buildRecordingPlayback(),
                const SizedBox(height: 16),
                _buildNextButton(),
              ],
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  // ââ í¤ë ââ
  Widget _buildHeader() {
    return Column(
      children: [
        Text(
          'Speech Coach',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            color: Colors.amber.shade300,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'AI ê¸°ë° ìì´ ë°ì êµì  & ë¬¸ë² íìµ ëêµ¬',
          style: TextStyle(
            fontSize: 13,
            color: Colors.white.withOpacity(0.6),
          ),
        ),
      ],
    );
  }

  // ââ ë ë²¨ ì í ââ
  Widget _buildLevelSelector() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.white.withOpacity(0.08),
            Colors.white.withOpacity(0.04),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.amber.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.arrow_back, color: Colors.amber.shade300, size: 16),
              const SizedBox(width: 8),
              Text(
                'ë ë²¨ ì í',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.9),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: List.generate(_levels.length, (i) {
              final isSelected = _currentLevel == i;
              return GestureDetector(
                onTap: () {
                  setState(() => _currentLevel = i);
                  _loadSentence();
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? Colors.amber.shade300
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isSelected
                          ? Colors.amber.shade300
                          : Colors.white.withOpacity(0.3),
                    ),
                  ),
                  child: Text(
                    _levels[i]['name']!,
                    style: TextStyle(
                      fontSize: 12,
                      color: isSelected ? Colors.black87 : Colors.white70,
                      fontWeight:
                          isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // ââ ë¬¸ì¥ ì¹´ë ââ
  Widget _buildSentenceCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Colors.white.withOpacity(0.12),
            Colors.white.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          Text(
            'ìë ë¬¸ì¥ì í° ìë¦¬ë¡ ì½ì´ë³´ì¸ì',
            style: TextStyle(
              color: Colors.white.withOpacity(0.6),
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 16),
          // ë°ì´í ìì´ì½
          Align(
            alignment: Alignment.centerLeft,
            child: Icon(Icons.format_quote,
                color: Colors.amber.shade300, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            _currentSentence,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 20),
          // ë²í¼ í
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _actionButton(
                'ë¤ë¥¸ ë¬¸ì¥ ë°ê¾¸ê¸°',
                Icons.refresh,
                _changeSentence,
                filled: false,
              ),
              const SizedBox(width: 12),
              _actionButton(
                'ìì´ë¯¼ ë°ì ë£ê¸°',
                Icons.volume_up,
                _playNativePronunciation,
                filled: true,
              ),
            ],
          ),
          const SizedBox(height: 16),
          // ìë ì¡°ì 
          Row(
            children: [
              Text('ëë¦¬ê²',
                  style:
                      TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11)),
              Expanded(
                child: Slider(
                  value: _playbackSpeed,
                  min: 0.5,
                  max: 1.5,
                  divisions: 10,
                  activeColor: Colors.cyan,
                  inactiveColor: Colors.white.withOpacity(0.2),
                  onChanged: (v) => setState(() => _playbackSpeed = v),
                ),
              ),
              Text('ë¹ ë¥´ê²',
                  style:
                      TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 11)),
            ],
          ),
          Text(
            '${_playbackSpeed.toStringAsFixed(1)}x',
            style: TextStyle(color: Colors.cyan.shade300, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _actionButton(
    String label,
    IconData icon,
    VoidCallback onTap, {
    bool filled = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: filled ? Colors.blue : Colors.transparent,
          borderRadius: BorderRadius.circular(24),
          border:
              filled ? null : Border.all(color: Colors.white.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: Colors.white, size: 16),
            const SizedBox(width: 6),
            Text(label,
                style: const TextStyle(color: Colors.white, fontSize: 13)),
          ],
        ),
      ),
    );
  }

  // ââ ìë íìê¸° ââ
  Widget _buildAttemptIndicator() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.1),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            _isRecording
                ? 'ð´ ë¹ì ì¤... ë¤ì ëë¬ ì¤ì§'
                : 'ìë $_attemptNumber/$maxAttempts - ë²í¼ì ëë¬ ë¹ìì ììíì¸ì',
            style: const TextStyle(color: Colors.white, fontSize: 14),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(maxAttempts, (i) {
            final isCompleted = i < _attemptNumber - 1;
            final isCurrent = i == _attemptNumber - 1;
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 4),
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isCompleted
                    ? Colors.green
                    : isCurrent
                        ? Colors.amber
                        : Colors.white.withOpacity(0.3),
                border: isCurrent
                    ? Border.all(color: Colors.amber.shade300, width: 2)
                    : null,
              ),
            );
          }),
        ),
      ],
    );
  }

  // ââ ë¹ì ë²í¼ ââ
  Widget _buildRecordButton() {
    return GestureDetector(
      onTap: _toggleRecording,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _isRecording ? _pulseAnimation.value : 1.0,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _isRecording ? Colors.red.shade700 : Colors.red,
                boxShadow: [
                  BoxShadow(
                    color: (_isRecording ? Colors.red : Colors.red.shade300)
                        .withOpacity(0.4),
                    blurRadius: _isRecording ? 30 : 15,
                    spreadRadius: _isRecording ? 8 : 2,
                  ),
                ],
              ),
              child: Icon(
                _isRecording ? Icons.stop : Icons.mic,
                color: Colors.white,
                size: 36,
              ),
            ),
          );
        },
      ),
    );
  }

  // ââ ë¶ì ì¤ íì ââ
  Widget _buildAnalyzingIndicator() {
    return Container(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          const CircularProgressIndicator(color: Colors.amber),
          const SizedBox(height: 16),
          Text(
            'AIê° ë°ìì ë¶ìíê³  ììµëë¤...',
            style: TextStyle(color: Colors.white.withOpacity(0.7)),
          ),
        ],
      ),
    );
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  í¼ëë°± ì¹ì
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Widget _buildFeedbackSection() {
    final scores = _feedbackResult!['scores'] as Map<String, dynamic>;
    final errors = _feedbackResult!['errors'] as List;
    final overallScore = _feedbackResult!['overallScore'] as int;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.teal.withOpacity(0.15),
            Colors.teal.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border(
          top: BorderSide(color: Colors.teal.shade300, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ì ëª©
          Row(
            children: [
              Container(
                width: 4,
                height: 20,
                color: Colors.teal.shade300,
              ),
              const SizedBox(width: 8),
              const Text(
                'ë¶ì ê²°ê³¼',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ì ì²´ ì ì
          Center(
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: _scoreColor(overallScore),
                  width: 4,
                ),
              ),
              child: Center(
                child: Text(
                  '$overallScore',
                  style: TextStyle(
                    color: _scoreColor(overallScore),
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // ë´ ë°ì vs AI êµì 
          Row(
            children: [
              Expanded(
                child: _feedbackCard(
                  'íìì ë¬¸ì¥ (YOUR SPEECH)',
                  _feedbackResult!['spokenText'] ?? '',
                  Colors.red.shade300,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _feedbackCard(
                  'AI êµì  ë¬¸ì¥ (CORRECTED)',
                  _feedbackResult!['correctedText'] ?? '',
                  Colors.green.shade300,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // ì¸ë¶ ì ì
          _scoreBar('ì íë', scores['accuracy'] as int),
          _scoreBar('ì ì°½ì±', scores['fluency'] as int),
          _scoreBar('ìì±ë', scores['completeness'] as int),

          // ì¤ë¥ ëª©ë¡
          if (errors.isNotEmpty) ...[
            const SizedBox(height: 16),
            Text(
              'êµì  í¬ì¸í¸',
              style: TextStyle(
                color: Colors.amber.shade300,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            ...errors.map((e) => _errorItem(e as Map<String, dynamic>)),
          ],
        ],
      ),
    );
  }

  Widget _feedbackCard(String title, String text, Color titleColor) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(color: titleColor, fontSize: 11, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            text,
            style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _scoreBar(String label, int score) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          SizedBox(
            width: 60,
            child: Text(
              label,
              style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                value: score / 100,
                backgroundColor: Colors.white.withOpacity(0.1),
                valueColor: AlwaysStoppedAnimation(_scoreColor(score)),
                minHeight: 8,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$score',
            style: TextStyle(
              color: _scoreColor(score),
              fontWeight: FontWeight.bold,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _errorItem(Map<String, dynamic> error) {
    final isTypeMissing = error['type'] == 'missing';
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: (isTypeMissing ? Colors.orange : Colors.red).withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color:
              (isTypeMissing ? Colors.orange : Colors.red).withOpacity(0.3),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isTypeMissing ? Icons.warning_amber : Icons.record_voice_over,
            color: isTypeMissing ? Colors.orange : Colors.red.shade300,
            size: 18,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                children: [
                  TextSpan(
                    text: '"${error['word']}" ',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextSpan(
                    text: 'â ${error['suggestion']}',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _scoreColor(int score) {
    if (score >= 80) return Colors.green.shade400;
    if (score >= 60) return Colors.amber.shade400;
    return Colors.red.shade400;
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââ
  //  ð§ ë´ ë¹ì ì¬ì ì¸ì
  // ââââââââââââââââââââââââââââââââââââââââââââââ
  Widget _buildRecordingPlayback() {
    if (!_hasRecording || _recordingPath == null) {
      return const SizedBox.shrink();
    }

    final progress = _playbackDuration.inMilliseconds > 0
        ? _playbackPosition.inMilliseconds / _playbackDuration.inMilliseconds
        : 0.0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            Colors.indigo.withOpacity(0.2),
            Colors.purple.withOpacity(0.1),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.indigo.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Text('ð§', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              const Text(
                'ë´ê° ë§í ìì± ë£ê¸°',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ì¬ì ì¬ë¼ì´ë
          SliderTheme(
            data: SliderThemeData(
              trackHeight: 4,
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
              activeTrackColor: Colors.indigo.shade300,
              inactiveTrackColor: Colors.white.withOpacity(0.15),
              thumbColor: Colors.indigo.shade200,
            ),
            child: Slider(
              value: progress.clamp(0.0, 1.0),
              onChanged: _seekTo,
            ),
          ),

          // ìê° íì
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDuration(_playbackPosition),
                style: TextStyle(
                    color: Colors.white.withOpacity(0.5), fontSize: 12),
              ),
              Text(
                _formatDuration(_playbackDuration),
                style: TextStyle(
                    color: Colors.white.withOpacity(0.5), fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // ì¬ì/ì¼ìì ì§ ë²í¼
          GestureDetector(
            onTap: _togglePlayback,
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [Colors.indigo, Colors.purple.shade700],
                ),
                boxShadow: [
                  BoxShadow(
                    color: Colors.indigo.withOpacity(0.4),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Icon(
                _isPlaying ? Icons.pause : Icons.play_arrow,
                color: Colors.white,
                size: 28,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDuration(Duration d) {
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  // ââ ë¤ì ìë / êµì  ë¬¸ì¥ ë£ê¸° ë²í¼ ââ
  Widget _buildNextButton() {
    return Column(
      children: [
        // êµì ë ë¬¸ì¥ ë£ê¸°
        GestureDetector(
          onTap: () {
            final corrected = _feedbackResult?['correctedText'] ?? _currentSentence;
            _ttsPlayer.setPlaybackRate(_playbackSpeed);
            _ttsPlayer.play(UrlSource(
              'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${Uri.encodeComponent(corrected)}',
            ));
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.blue,
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.volume_up, color: Colors.white, size: 18),
                SizedBox(width: 8),
                Text('êµì ë ë¬¸ì¥ ë£ê¸°',
                    style: TextStyle(color: Colors.white, fontSize: 14)),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),

        // ë¤ì ìëíê¸°
        GestureDetector(
          onTap: _nextAttempt,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.amber,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Text(
              _attemptNumber < maxAttempts ? 'ë¤ì ìëíê¸°' : 'ì ë¬¸ì¥ì¼ë¡',
              style: const TextStyle(
                color: Colors.black87,
                fontSize: 14,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
