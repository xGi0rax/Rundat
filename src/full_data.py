import pandas as pd
from infrastructure.clientGarmin import get_client

# Function to fetch Garmin data with all the attributes, and save the running activities to CSV
def fetch_full_datas():
    # Get Garmin client with token management
    client = get_client()


    try:
        # TODO: Prendere tutte le attività, non solo le ultime 10
        print("Downloading latest 10 activities...")
        activities = client.get_activities(0, 10)

        # Conversion in DataFrame Pandas
        df = pd.DataFrame(activities)

        # Filtration of running activities
        df_running = df[df['activityType'].apply(lambda x: x['typeKey'] == 'running')]

        # Save data to CSV for future use
        df_running.to_csv('running_activities_FULL.csv', index=False)
        print("✅ Saved to running_activities_FULL.csv")

    except Exception as e:
        print(f"❌ Error fetching data: {e}")

if __name__ == "__main__":
    fetch_full_datas()