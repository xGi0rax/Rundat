import pandas as pd
import plotly.express as px

def show_dashboard():
    try:
        # Load data from CSV
        df_running = pd.read_csv('running_activities.csv')

        # Ensure 'startTimeLocal' is in datetime format
        df_running['startTimeLocal'] = pd.to_datetime(df_running['startTimeLocal'])

        # Visualization with Plotly
        if not df_running.empty:
            fig = px.bar(
                df_running, 
                x='startTimeLocal', 
                y='distance',
                title='Runs (km)',
                labels={'startTimeLocal': 'Date', 'distance': 'Total km'},
                text='distance',
                hover_data=['averageHR', 'duration'],
                template='plotly_dark'
            )
            fig.update_traces(textposition='outside', textfont_size=12)
            fig.show()

        else:
            print("No running activities found.")
    
    except FileNotFoundError:
        print("Error: 'running_activities.csv' not found.")


if __name__ == "__main__":
    show_dashboard()