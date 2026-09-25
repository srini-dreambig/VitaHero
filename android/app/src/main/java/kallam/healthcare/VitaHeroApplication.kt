package kallam.healthcare

import android.app.Application
import android.util.Log
import kallam.healthcare.data.AppContainer

class VitaHeroApplication : Application() {

    private var _appContainer: AppContainer? = null

    val appContainer: AppContainer
        get() = _appContainer ?: synchronized(this) {
            _appContainer ?: try {
                AppContainer(this)
            } catch (e: Exception) {
                Log.e("VitaHero", "Failed to initialize AppContainer lazily", e)
                AppContainer(this)
            }.also { _appContainer = it }
        }

    override fun onCreate() {
        super.onCreate()
        // Every uncaught crash is logged with its full stack before the
        // process dies, so a device-side failure can be diagnosed from the
        // runtime logs instead of only from a user's "it crashed".
        val platform = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            Log.e("VitaHero", "Uncaught exception on ${thread.name}", e)
            platform?.uncaughtException(thread, e)
        }
        try {
            _appContainer = AppContainer(this)
        } catch (e: Exception) {
            Log.e("VitaHero", "Failed to initialize AppContainer on onCreate", e)
        }
    }
}
