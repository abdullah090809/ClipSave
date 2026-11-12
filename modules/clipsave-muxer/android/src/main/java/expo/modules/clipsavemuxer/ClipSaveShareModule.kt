package expo.modules.clipsavemuxer

import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Hands links shared to ClipSave (Android share sheet, ACTION_SEND with text) over to JavaScript.
 *
 * React Native only passes ordinary deep links (ACTION_VIEW) to JS. The text of a share lives in the
 * intent extras, so without this module the app opens from the share sheet but never sees the link.
 *  - getInitialSharedText(): the share that started the app, or null.
 *  - "onSharedText" event: a share that arrives while the app is already running.
 */
class ClipSaveShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ClipSaveShare")

    Events("onSharedText")

    Function("getInitialSharedText") {
      readSharedText(appContext.currentActivity?.intent)
    }

    OnNewIntent { intent ->
      val text = readSharedText(intent)
      if (text != null) {
        sendEvent("onSharedText", mapOf("text" to text))
      }
    }
  }

  private fun readSharedText(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    val text = intent.getStringExtra(Intent.EXTRA_TEXT)
    if (text.isNullOrBlank()) return null
    // Hand each share over once, so reopening the screen does not paste it again.
    intent.removeExtra(Intent.EXTRA_TEXT)
    return text
  }
}
