<?php
ini_set('display_errors', '0');
@set_time_limit(90);

require dirname(__DIR__) . '/auth.php';

function senmonka_json($code, $payload)
{
    http_response_code((int) $code);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    echo is_string($json) ? $json : '{"error":"サーバーでエラーが発生しました。もう一度お試しください。"}';
    exit;
}

function senmonka_trim($value)
{
    $value = (string) $value;
    $trimmed = preg_replace('/^\s+|\s+$/u', '', $value);
    return is_string($trimmed) ? $trimmed : trim($value);
}

function senmonka_chars($value)
{
    if (function_exists('mb_strlen')) {
        return mb_strlen($value, 'UTF-8');
    }
    $count = preg_match_all('/./u', $value, $matches);
    return $count === false ? strlen($value) : $count;
}

function senmonka_lower($value)
{
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($value, 'UTF-8');
    }
    return strtolower($value);
}

function senmonka_contains($haystack, $needle)
{
    if ($needle === '') {
        return false;
    }
    if (function_exists('mb_strpos')) {
        return mb_strpos($haystack, $needle, 0, 'UTF-8') !== false;
    }
    return strpos($haystack, $needle) !== false;
}

function senmonka_personas()
{
    $path = __DIR__ . '/personas.json';
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || !isset($data['prompts']) || !is_array($data['prompts'])) {
        return null;
    }
    return $data;
}

function senmonka_api_key()
{
    $path = '/home/xs519923/xs519923.xsrv.jp/config.php';
    if (!is_file($path)) {
        return '';
    }
    $real = realpath($path);
    if (!is_string($real) || $real === '') {
        return '';
    }
    $norm = str_replace('\\', '/', $real);
    if (preg_match('#/public_html(/|$)#', $norm)) {
        return '';
    }
    if (basename($norm) !== 'config.php') {
        return '';
    }
    $level = ob_get_level();
    ob_start();
    try {
        $config = include $real;
    } catch (Exception $e) {
        $config = null;
    }
    while (ob_get_level() > $level) {
        ob_end_clean();
    }
    if (!is_array($config) || !isset($config['GEMINI_API_KEY']) || !is_string($config['GEMINI_API_KEY'])) {
        return '';
    }
    return trim($config['GEMINI_API_KEY']);
}

function senmonka_pick_expert($worry, $offButton)
{
    $text = senmonka_lower(senmonka_trim($worry));
    if ($text === '' || !is_array($offButton)) {
        return null;
    }
    $best = null;
    $bestScore = 0;
    foreach ($offButton as $def) {
        if (!is_array($def) || !isset($def['keywords']) || !is_array($def['keywords'])) {
            continue;
        }
        $score = 0;
        foreach ($def['keywords'] as $keyword) {
            if (!is_string($keyword)) {
                continue;
            }
            if (senmonka_contains($text, senmonka_lower($keyword))) {
                $score += 1;
            }
        }
        if ($score > $bestScore) {
            $bestScore = $score;
            $best = $def;
        }
    }
    return $bestScore > 0 ? $best : null;
}

function senmonka_error_message($data)
{
    if (is_array($data) && isset($data['error']['message']) && is_string($data['error']['message'])) {
        return $data['error']['message'];
    }
    return '';
}

function senmonka_reading_text($data)
{
    if (!is_array($data) || !isset($data['candidates'][0]['content']['parts']) || !is_array($data['candidates'][0]['content']['parts'])) {
        return '';
    }
    $texts = array();
    foreach ($data['candidates'][0]['content']['parts'] as $part) {
        if (!is_array($part) || !empty($part['thought'])) {
            continue;
        }
        if (isset($part['text']) && is_string($part['text'])) {
            $texts[] = $part['text'];
        }
    }
    $text = implode("\n", $texts);
    $bold = preg_replace('/\*\*(.+?)\*\*/s', '$1', $text);
    if (is_string($bold)) {
        $text = $bold;
    }
    $bullets = preg_replace('/^[ \t]*\*\s+/m', '・', $text);
    if (is_string($bullets)) {
        $text = $bullets;
    }
    return trim($text);
}

function senmonka_is_retryable($status, $message)
{
    if (in_array($status, array(0, 404, 408, 429, 500, 502, 503, 504), true)) {
        return true;
    }
    return preg_match('/quota|rate.?limit|resource.?exhausted|high demand|unavailable|not found|is not supported|timeout/i', $message) === 1;
}

function senmonka_gemini_once($apiKey, $model, $systemPrompt, $userMessage, $withThinking)
{
    $generation = array(
        'temperature' => 0.7,
        'maxOutputTokens' => 2048,
    );
    if ($withThinking) {
        if (strpos((string) $model, 'gemini-3') === 0) {
            $generation['thinkingConfig'] = array('thinkingLevel' => 'low');
        } else {
            $generation['thinkingConfig'] = array('thinkingBudget' => 0);
        }
    }
    $payload = array(
        'systemInstruction' => array(
            'parts' => array(array('text' => $systemPrompt)),
        ),
        'contents' => array(
            array('parts' => array(array('text' => $userMessage))),
        ),
        'generationConfig' => $generation,
    );
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($body)) {
        return array('ok' => false, 'status' => 500, 'data' => array());
    }
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent';
    $ch = curl_init($url);
    $opts = array(
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => array(
            'Content-Type: application/json',
            'x-goog-api-key: ' . $apiKey,
        ),
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
    );
    if (defined('CURLOPT_IPRESOLVE') && defined('CURL_IPRESOLVE_V4')) {
        $opts[CURLOPT_IPRESOLVE] = CURL_IPRESOLVE_V4;
    }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($errno !== 0 || $status === 0) {
        return array('ok' => false, 'status' => 504, 'data' => array());
    }
    $data = array();
    if (is_string($raw) && $raw !== '') {
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $data = $decoded;
        }
    }
    $ok = $status >= 200 && $status < 300 && !isset($data['error']);
    return array('ok' => $ok, 'status' => $status, 'data' => $data);
}

function senmonka_gemini($apiKey, $model, $systemPrompt, $userMessage)
{
    $result = senmonka_gemini_once($apiKey, $model, $systemPrompt, $userMessage, true);
    $message = senmonka_error_message($result['data']);
    if (!$result['ok'] && (int) $result['status'] === 400 && stripos($message, 'thinking') !== false) {
        $result = senmonka_gemini_once($apiKey, $model, $systemPrompt, $userMessage, false);
    }
    return $result;
}

if (!senmonka_logged_in()) {
    senmonka_json(401, array('error' => 'ログインしてください。'));
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    senmonka_json(405, array('error' => 'Method not allowed'));
}

$personas = senmonka_personas();
if (!is_array($personas)) {
    senmonka_json(500, array('error' => 'サーバーでエラーが発生しました。もう一度お試しください。'));
}

$apiKey = senmonka_api_key();
if ($apiKey === '') {
    senmonka_json(500, array('error' => 'APIキーが設定されていません。'));
}

$rawBody = file_get_contents('php://input');
if (!is_string($rawBody)) {
    $rawBody = '';
}
if (strlen($rawBody) > 200000) {
    senmonka_json(400, array('error' => '悩みは2000文字以内で入力してください。'));
}
$body = json_decode($rawBody, true);
if (!is_array($body)) {
    $body = array();
}

$maxLength = isset($personas['maxWorryLength']) ? (int) $personas['maxWorryLength'] : 2000;
$worryText = senmonka_trim(isset($body['worry']) ? $body['worry'] : '');
$expert = isset($body['expert']) ? (string) $body['expert'] : '';
$prompts = $personas['prompts'];
if ($worryText === '' || $expert === '' || !isset($prompts[$expert]) || !is_string($prompts[$expert])) {
    senmonka_json(400, array('error' => '悩みと相談したい人の指定が必要です。'));
}
if (senmonka_chars($worryText) > $maxLength) {
    senmonka_json(400, array('error' => '悩みは' . $maxLength . '文字以内で入力してください。'));
}

$names = isset($personas['names']) && is_array($personas['names']) ? $personas['names'] : array();
$picked = senmonka_pick_expert($worryText, isset($personas['offButton']) ? $personas['offButton'] : array());
if (is_array($picked) && isset($picked['systemPrompt'], $picked['name']) && is_string($picked['systemPrompt'])) {
    $systemPrompt = $picked['systemPrompt'];
    $expertName = (string) $picked['name'];
} else {
    $picked = null;
    $systemPrompt = $prompts[$expert];
    $expertName = isset($names[$expert]) && is_string($names[$expert]) ? $names[$expert] : $expert;
}

$ageInstruction = '';
if (isset($body['age']) && is_numeric($body['age'])) {
    $ageNumber = (int) $body['age'];
    if ($ageNumber >= 1 && $ageNumber <= 120 && (float) $body['age'] === (float) $ageNumber) {
        $ageInstruction = "\n【重要】相談者は" . $ageNumber . "歳です。年齢に合わせて、わかりやすく寄り添った言葉で回答してください。小学生以下なら易しい表現に、高齢者なら丁寧で落ち着いた表現に、若年層なら親しみやすい表現に調整してください。";
    }
}

$structure = isset($personas['replyStructure']) && is_string($personas['replyStructure'])
    ? str_replace('{{LABEL}}', $expertName, $personas['replyStructure'])
    : '';
$userMessage = "以下の悩みについて、" . $expertName . "としてアドバイスをお願いします。" . $ageInstruction . "\n\n"
    . $structure . "\n\n【相談内容】\n" . $worryText;

$listed = isset($personas['models']) && is_array($personas['models']) ? $personas['models'] : array();
$models = array();
foreach (array('gemini-2.5-flash', 'gemini-3.8-flash') as $preferred) {
    if (in_array($preferred, $listed, true) || !$listed) {
        $models[] = $preferred;
    }
}
foreach ($listed as $model) {
    if (is_string($model) && $model !== '' && !in_array($model, $models, true)) {
        $models[] = $model;
    }
}
if (!$models) {
    $models = array('gemini-2.5-flash', 'gemini-3.8-flash');
}

try {
    $result = null;
    foreach ($models as $model) {
        if (!is_string($model) || $model === '') {
            continue;
        }
        $result = senmonka_gemini($apiKey, $model, $systemPrompt, $userMessage);
        $message = senmonka_error_message(isset($result['data']) ? $result['data'] : array());
        $retryable = empty($result['ok']) && senmonka_is_retryable((int) $result['status'], $message);
        error_log('senmonka-advice gemini model=' . $model . ' status=' . (isset($result['status']) ? (int) $result['status'] : 0));
        if (!empty($result['ok']) && senmonka_reading_text(isset($result['data']) ? $result['data'] : array()) !== '') {
            break;
        }
        if (!empty($result['ok'])) {
            $result['ok'] = false;
            $result['status'] = 502;
        }
        if (!$retryable && (int) $result['status'] !== 502) {
            break;
        }
    }
    $data = is_array($result) && isset($result['data']) && is_array($result['data']) ? $result['data'] : array();
    if (!is_array($result) || empty($result['ok']) || isset($data['error'])) {
        $message = senmonka_error_message($data);
        $status = is_array($result) && isset($result['status']) ? (int) $result['status'] : 502;
        $isQuota = $status === 429 || $status === 503 || preg_match('/quota|rate.?limit|resource.?exhausted|high demand|unavailable/i', $message) === 1;
        senmonka_json($isQuota ? 429 : 502, array(
            'error' => $isQuota
                ? 'いま相談が混み合っています。少し待ってから、もう一度お試しください。'
                : '回答を作成できませんでした。もう一度お試しください。',
        ));
    }
    if (!empty($data['promptFeedback']['blockReason'])) {
        senmonka_json(422, array(
            'error' => 'この内容では回答を作成できませんでした。表現を変えて、もう一度お試しください。',
        ));
    }
    $reply = senmonka_reading_text($data);
    if ($reply === '') {
        $blocked = isset($data['candidates'][0]['finishReason']) && $data['candidates'][0]['finishReason'] === 'SAFETY';
        senmonka_json($blocked ? 422 : 502, array(
            'error' => $blocked
                ? '安全上の理由で回答を作成できませんでした。表現を変えて、もう一度お試しください。'
                : '回答を作成できませんでした。もう一度お試しください。',
        ));
    }
    senmonka_json(200, array(
        'reply' => $reply,
        'pickedExpert' => is_array($picked) ? array('id' => $picked['id'], 'name' => $picked['name']) : null,
    ));
} catch (Exception $e) {
    error_log('senmonka-advice consult failed');
    senmonka_json(500, array('error' => 'サーバーでエラーが発生しました。もう一度お試しください。'));
}
