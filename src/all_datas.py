import os
import pandas as pd
import garth
from dotenv import load_dotenv
from garminconnect import Garmin

# Credentials loading
load_dotenv()
email = os.getenv("GARMIN_EMAIL")
password = os.getenv("GARMIN_PASSWORD")
token_path = os.path.abspath(".session")

def fetch_garmin_data():
    if not os.path.exists(token_path):
        os.makedirs(token_path)

    # Connection to Garmin
    try:
        print("Attempting to restore session from disk...")
        garth.resume(token_path)
        print("Session restored successfully!")
    except Exception:
        print("Session not found or expired. Performing full login...")
        try:
            garth.login(email, password)
            garth.save(token_path)
            print("✅ Login Garth effettuato e file salvati correttamente!")
        except Exception as e:
            if "429" in str(e):
                print("🚫 Blocco 429 attivo. Aspetta un'ora prima di riprovare.")
                return
            else:
                print(f"💥 Errore durante il login: {e}")
                return

    try:
        client = Garmin()

        # Fetching activities (last 10 activities)
        print("Fetching last 10 activities...")
        activities = client.get_activities(0, 10)

        # Conversion in DataFrame Pandas
        df = pd.DataFrame(activities)

        # # Print of ALL columns
        # print("--- Available columns in the data ---")
        # for col in df.columns:
        #     print(col)
        # print("-----------------------------------")

        # Filtration of running activities
        df_running = df[df['activityType'].apply(lambda x: x['typeKey'] == 'running')]
        print(f"Found {len(df_running)} running activities.")

        # Save all the data to CSV for future use
        df_running.to_csv('running_activities_FULL.csv', index=False)

    except Exception as e:
        print(f"❌ Errore durante l'esecuzione: {e}")

if __name__ == "__main__":
    fetch_garmin_data()