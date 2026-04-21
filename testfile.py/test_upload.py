import requests
import traceback

files = {'file': open('Dataset.csv','rb')}
try:
    resp = requests.post('http://localhost:5000/upload-data', files=files, timeout=5)
    print(resp.status_code, resp.text[:500])
except Exception as e:
    traceback.print_exc()