package expo.modules.clipsavemuxer

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer

/**
 * Joins a video-only MP4 and an audio-only M4A into a single MP4 by copying the encoded
 * samples as they are (no re-encoding), using Android's built-in MediaExtractor/MediaMuxer.
 */
class ClipSaveMuxerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ClipSaveMuxer")

    // Runs on a background thread, never on the JS thread.
    AsyncFunction("mux") { videoUri: String, audioUri: String, outputUri: String ->
      try {
        muxFiles(toPath(videoUri), toPath(audioUri), toPath(outputUri))
      } catch (e: CodedException) {
        throw e
      } catch (e: Exception) {
        throw CodedException("ERR_MUX", e.message ?: "Could not join video and audio.", e)
      }
    }
  }

  private fun toPath(uri: String): String =
    if (uri.startsWith("file://")) (Uri.parse(uri).path ?: uri.removePrefix("file://")) else uri

  private fun findTrack(extractor: MediaExtractor, mimePrefix: String): Int {
    for (i in 0 until extractor.trackCount) {
      val mime = extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith(mimePrefix)) return i
    }
    return -1
  }

  private fun muxFiles(videoPath: String, audioPath: String, outPath: String) {
    val outFile = File(outPath)
    if (outFile.exists()) outFile.delete()

    val videoEx = MediaExtractor()
    val audioEx = MediaExtractor()
    var muxer: MediaMuxer? = null
    var started = false
    var success = false

    try {
      videoEx.setDataSource(videoPath)
      audioEx.setDataSource(audioPath)

      val vTrack = findTrack(videoEx, "video/")
      val aTrack = findTrack(audioEx, "audio/")
      if (vTrack < 0) throw IllegalStateException("The downloaded video file has no video track.")
      if (aTrack < 0) throw IllegalStateException("The downloaded audio file has no audio track.")
      videoEx.selectTrack(vTrack)
      audioEx.selectTrack(aTrack)

      val vFormat = videoEx.getTrackFormat(vTrack)
      val aFormat = audioEx.getTrackFormat(aTrack)

      val m = MediaMuxer(outPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      muxer = m
      val vOut = m.addTrack(vFormat)
      val aOut = m.addTrack(aFormat)
      m.start()
      started = true

      var bufferSize = 4 * 1024 * 1024
      for (f in listOf(vFormat, aFormat)) {
        if (f.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
          bufferSize = maxOf(bufferSize, f.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE))
        }
      }
      val buffer = ByteBuffer.allocate(bufferSize)
      val info = MediaCodec.BufferInfo()

      var videoDone = videoEx.sampleTime < 0
      var audioDone = audioEx.sampleTime < 0

      // Write whichever stream is earlier in time so the file is interleaved and seeks well.
      while (!videoDone || !audioDone) {
        val useVideo = !videoDone && (audioDone || videoEx.sampleTime <= audioEx.sampleTime)
        val extractor = if (useVideo) videoEx else audioEx
        val outTrack = if (useVideo) vOut else aOut

        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) {
          if (useVideo) videoDone = true else audioDone = true
          continue
        }
        val flags =
          if ((extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
        info.set(0, size, extractor.sampleTime, flags)
        m.writeSampleData(outTrack, buffer, info)
        if (!extractor.advance()) {
          if (useVideo) videoDone = true else audioDone = true
        }
      }
      m.stop()
      started = false
      success = true
    } finally {
      try {
        if (started) muxer?.stop()
      } catch (ignored: Exception) {
      }
      try {
        muxer?.release()
      } catch (ignored: Exception) {
      }
      videoEx.release()
      audioEx.release()
      if (!success) outFile.delete()
    }
  }
}
